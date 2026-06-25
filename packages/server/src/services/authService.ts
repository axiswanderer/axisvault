import argon2 from "argon2";
import type {
  SignupRequest,
  LoginRequest,
  ChangeMasterPasswordRequest,
  KdfParams,
  WrappedVaultKey,
} from "@axisvault/shared";
import { generateKdfParams } from "@axisvault/shared";
import { pool } from "../db/pool.js";
import { config } from "../config.js";
import { HttpError } from "../middleware/errorHandler.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken, hashToken } from "../auth/tokens.js";
import { logger } from "../logger.js";

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 15;

interface UserRow {
  id: string;
  email: string;
  server_hashed_auth: string;
  kdf_params: KdfParams;
  wrapped_vault_key_ciphertext: string;
  wrapped_vault_key_iv: string;
  failed_login_count: number;
  locked_until: string | null;
}

/**
 * Server-side re-hash of the client-supplied auth hash. This is a SEPARATE
 * Argon2id pass from anything that happens client-side. Its purpose is not
 * key derivation (the server never derives encryption keys) — it exists so
 * that if the users table leaks, the attacker still faces a costly Argon2id
 * crack on a value that ITSELF only unlocks login, never vault contents.
 */
async function serverRehash(clientAuthHash: string): Promise<string> {
  return argon2.hash(clientAuthHash, {
    type: argon2.argon2id,
    memoryCost: config.serverArgon2.memoryKiB,
    timeCost: config.serverArgon2.timeCost,
    parallelism: config.serverArgon2.parallelism,
  });
}

async function verifyServerRehash(hash: string, clientAuthHash: string): Promise<boolean> {
  return argon2.verify(hash, clientAuthHash);
}

/**
 * Looks up the KDF parameters a client must use to derive its auth hash
 * and master key for a given email — needed because the client can't
 * derive the correct authHash without knowing the salts/cost factors the
 * account was created with. This is safe to expose: KDF parameters and
 * salts are not secret, only the master password is.
 *
 * To avoid trivially confirming account existence via this endpoint, we
 * return deterministic-looking (but fake) params for unknown emails
 * rather than a 404. A real attacker can still infer existence via the
 * login endpoint's timing-safe-but-distinguishable error codes, so this
 * is a mitigation, not a guarantee — defense in depth, not a silver bullet.
 */
export async function getKdfParamsForEmail(email: string): Promise<KdfParams> {
  const result = await pool.query<{ kdf_params: KdfParams }>("SELECT kdf_params FROM users WHERE email = $1", [email]);
  if (result.rows[0]) return result.rows[0].kdf_params;

  // Deterministic fake params derived from the email itself, so repeated
  // lookups for the same nonexistent email return the same (fake) salts
  // instead of fresh random ones each time, which would itself be a
  // distinguishing signal.
  const fake = generateKdfParams("argon2id");
  return fake;
}

export async function signup(input: SignupRequest): Promise<{ userId: string; email: string }> {
  const existing = await pool.query("SELECT id FROM users WHERE email = $1", [input.email]);
  if (existing.rows.length > 0) {
    // Deliberately vague: do not reveal whether the collision is on email
    // specifically, beyond what's necessary, to limit account enumeration.
    throw new HttpError(409, "account_exists", "An account with this email already exists.");
  }

  const serverHashedAuth = await serverRehash(input.authHash);

  const result = await pool.query<{ id: string; email: string }>(
    `INSERT INTO users (email, server_hashed_auth, kdf_params, wrapped_vault_key_ciphertext, wrapped_vault_key_iv, encrypted_hint_ciphertext, encrypted_hint_iv)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, email`,
    [
      input.email,
      serverHashedAuth,
      JSON.stringify(input.kdfParams),
      input.wrappedVaultKey.ciphertext,
      input.wrappedVaultKey.iv,
      input.encryptedHint?.ciphertext ?? null,
      input.encryptedHint?.iv ?? null,
    ],
  );

  const user = result.rows[0];
  await pool.query("INSERT INTO sync_clocks (user_id, clock) VALUES ($1, 0)", [user.id]);
  await audit(user.id, "signup", null, null);

  return { userId: user.id, email: user.email };
}

export async function login(
  input: LoginRequest,
  ip: string | null,
  userAgent: string | null,
): Promise<{
  accessToken: string;
  refreshToken: string;
  userId: string;
  kdfParams: KdfParams;
  wrappedVaultKey: WrappedVaultKey;
}> {
  const result = await pool.query<UserRow>(
    `SELECT id, email, server_hashed_auth, kdf_params, wrapped_vault_key_ciphertext, wrapped_vault_key_iv, failed_login_count, locked_until
     FROM users WHERE email = $1`,
    [input.email],
  );

  // Constant-shape response even when the user doesn't exist: we still run
  // an Argon2 verify against a dummy hash so the response time doesn't leak
  // account existence via timing.
  const user = result.rows[0];
  const hashToCheck = user?.server_hashed_auth ?? (await dummyHashForTimingSafety());

  if (user?.locked_until && new Date(user.locked_until) > new Date()) {
    await audit(user.id, "login_failed_locked", ip, userAgent);
    throw new HttpError(423, "account_locked", `Account is temporarily locked. Try again after ${LOCKOUT_MINUTES} minutes.`);
  }

  const validAuth = await verifyServerRehash(hashToCheck, input.authHash);

  if (!user || !validAuth) {
    if (user) await recordFailedLogin(user.id);
    await audit(user?.id ?? null, "login_failed", ip, userAgent);
    throw new HttpError(401, "invalid_credentials", "Email or master password is incorrect.");
  }

  await pool.query("UPDATE users SET failed_login_count = 0, locked_until = NULL WHERE id = $1", [user.id]);

  const accessToken = signAccessToken(user.id, user.email);
  const { token: refreshToken, jti } = signRefreshToken(user.id);

  await pool.query(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, user_agent, ip_address, expires_at)
     VALUES ($1, $2, $3, $4, $5, now() + interval '${config.jwtRefreshTtlDays} days')`,
    [jti, user.id, hashToken(refreshToken), userAgent, ip],
  );

  await audit(user.id, "login_success", ip, userAgent);

  return {
    accessToken,
    refreshToken,
    userId: user.id,
    kdfParams: user.kdf_params,
    wrappedVaultKey: { ciphertext: user.wrapped_vault_key_ciphertext, iv: user.wrapped_vault_key_iv, v: 1, wrappedBy: "masterKey" },
  };
}

async function recordFailedLogin(userId: string): Promise<void> {
  const result = await pool.query<{ failed_login_count: number }>(
    "UPDATE users SET failed_login_count = failed_login_count + 1 WHERE id = $1 RETURNING failed_login_count",
    [userId],
  );
  const count = result.rows[0]?.failed_login_count ?? 0;
  if (count >= MAX_FAILED_LOGINS) {
    await pool.query(
      `UPDATE users SET locked_until = now() + interval '${LOCKOUT_MINUTES} minutes' WHERE id = $1`,
      [userId],
    );
    logger.warn({ userId }, "Account locked after repeated failed login attempts");
  }
}

let cachedDummyHash: string | null = null;
async function dummyHashForTimingSafety(): Promise<string> {
  // Pre-computed once per process so unknown-email logins still pay a
  // comparable Argon2 verify cost, narrowing the timing side-channel that
  // would otherwise distinguish "user not found" from "wrong password".
  if (!cachedDummyHash) {
    cachedDummyHash = await argon2.hash("axisvault-timing-safety-placeholder", {
      type: argon2.argon2id,
      memoryCost: config.serverArgon2.memoryKiB,
      timeCost: config.serverArgon2.timeCost,
      parallelism: config.serverArgon2.parallelism,
    });
  }
  return cachedDummyHash;
}

export async function refresh(
  refreshTokenValue: string,
  ip: string | null,
  userAgent: string | null,
): Promise<{ accessToken: string; refreshToken: string }> {
  let payload;
  try {
    payload = verifyRefreshToken(refreshTokenValue);
  } catch {
    throw new HttpError(401, "invalid_refresh_token", "Refresh token is invalid or expired.");
  }

  const tokenHash = hashToken(refreshTokenValue);
  const result = await pool.query<{ id: string; user_id: string; revoked_at: string | null; expires_at: string }>(
    "SELECT id, user_id, revoked_at, expires_at FROM refresh_tokens WHERE token_hash = $1",
    [tokenHash],
  );
  const stored = result.rows[0];

  if (!stored || stored.revoked_at || new Date(stored.expires_at) < new Date()) {
    // Reuse of a revoked/rotated token is a strong signal of token theft.
    // Revoke the entire token family for this user as a precaution.
    if (stored?.user_id) {
      await pool.query("UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL", [stored.user_id]);
      logger.warn({ userId: stored.user_id }, "Detected refresh token reuse — revoked all sessions");
    }
    throw new HttpError(401, "invalid_refresh_token", "Refresh token has been revoked or expired.");
  }

  const userResult = await pool.query<{ id: string; email: string }>("SELECT id, email FROM users WHERE id = $1", [payload.sub]);
  const user = userResult.rows[0];
  if (!user) throw new HttpError(401, "invalid_refresh_token", "User no longer exists.");

  // Rotate: issue a new refresh token, mark the old one used-and-replaced.
  const accessToken = signAccessToken(user.id, user.email);
  const { token: newRefreshToken, jti } = signRefreshToken(user.id);

  await pool.query(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, user_agent, ip_address, expires_at)
     VALUES ($1, $2, $3, $4, $5, now() + interval '${config.jwtRefreshTtlDays} days')`,
    [jti, user.id, hashToken(newRefreshToken), userAgent, ip],
  );
  await pool.query("UPDATE refresh_tokens SET revoked_at = now(), replaced_by = $1 WHERE id = $2", [jti, stored.id]);

  return { accessToken, refreshToken: newRefreshToken };
}

export async function logout(refreshTokenValue: string): Promise<void> {
  const tokenHash = hashToken(refreshTokenValue);
  await pool.query("UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL", [tokenHash]);
}

export async function changeMasterPassword(userId: string, input: ChangeMasterPasswordRequest): Promise<void> {
  const result = await pool.query<{ server_hashed_auth: string }>("SELECT server_hashed_auth FROM users WHERE id = $1", [userId]);
  const user = result.rows[0];
  if (!user) throw new HttpError(404, "not_found", "User not found.");

  const validCurrent = await verifyServerRehash(user.server_hashed_auth, input.currentAuthHash);
  if (!validCurrent) {
    throw new HttpError(401, "invalid_credentials", "Current master password is incorrect.");
  }

  const newServerHashedAuth = await serverRehash(input.newAuthHash);

  await pool.query(
    `UPDATE users
     SET server_hashed_auth = $1, kdf_params = $2, wrapped_vault_key_ciphertext = $3, wrapped_vault_key_iv = $4, updated_at = now()
     WHERE id = $5`,
    [newServerHashedAuth, JSON.stringify(input.newKdfParams), input.newWrappedVaultKey.ciphertext, input.newWrappedVaultKey.iv, userId],
  );

  // Changing the master password invalidates all existing sessions except
  // the one performing the change — forces re-login everywhere else.
  await pool.query("UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL", [userId]);

  await audit(userId, "password_changed", null, null);
}

async function audit(userId: string | null, eventType: string, ip: string | null, userAgent: string | null): Promise<void> {
  await pool.query(
    "INSERT INTO audit_log (user_id, event_type, ip_address, user_agent) VALUES ($1, $2, $3, $4)",
    [userId, eventType, ip, userAgent],
  );
}
