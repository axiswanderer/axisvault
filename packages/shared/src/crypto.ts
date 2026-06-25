/**
 * AxisVault Crypto Core
 * ---------------------
 * This module is the single source of truth for every cryptographic
 * operation in AxisVault. It is designed to run ONLY on the client
 * (browser, Electron renderer). The server never imports this module
 * for anything other than verifying an already-hashed authentication
 * value — it never sees a master password, a vault key, or plaintext
 * vault data.
 *
 * KEY HIERARCHY
 * -------------
 *  MasterPassword (never transmitted, never stored)
 *        │
 *        ├─ Argon2id(masterPassword, saltA, "axisvault-auth-v1")  -> AuthHash    (sent to server at login)
 *        │
 *        └─ Argon2id(masterPassword, saltB, "axisvault-enc-v1")  -> MasterKey   (stays on client)
 *                       │
 *                       └─ unwraps -> VaultKey (random 256-bit, generated once at signup)
 *                                          │
 *                                          └─ encrypts every vault item (AES-256-GCM)
 *
 * Why two derivations from one password (domain separation)?
 * If we used the same derived key both to authenticate AND to encrypt,
 * a compromised server (or a server operator) could brute-force or
 * replay the auth value and gain a value usable for decryption too.
 * By deriving AuthHash and MasterKey with different salts and different
 * context strings, the value the server stores/verifies is cryptographically
 * useless for decrypting vault data.
 *
 * Why a separate random VaultKey wrapped by MasterKey (envelope encryption)?
 * If the user changes their master password, we only need to re-wrap the
 * VaultKey (cheap), not re-encrypt every stored item (expensive, and risky
 * if interrupted halfway).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type KdfAlgorithm = "argon2id" | "pbkdf2-sha256";

export interface KdfParams {
  algorithm: KdfAlgorithm;
  /** Argon2id only */
  memoryKiB?: number;
  /** Argon2id: iterations: PBKDF2: iteration count */
  iterations: number;
  /** Argon2id only */
  parallelism?: number;
  /** base64-encoded, 16 bytes minimum */
  authSalt: string;
  /** base64-encoded, 16 bytes minimum */
  encSalt: string;
  version: 1;
}

export interface EncryptedBlob {
  /** base64-encoded ciphertext, AES-256-GCM auth tag appended by WebCrypto */
  ciphertext: string;
  /** base64-encoded 12-byte nonce/IV — must never be reused with the same key */
  iv: string;
  /** schema version for forward compatibility */
  v: 1;
}

export interface WrappedVaultKey extends EncryptedBlob {
  /** which key wrapped this blob, for key-rotation auditing */
  wrappedBy: "masterKey";
}

export interface DerivedAuthMaterial {
  /** base64 — sent to the server during login/signup, never the password itself */
  authHash: string;
}

export interface DerivedClientKeys {
  /** Raw AES-256-GCM CryptoKey, lives only in memory, never serialized to disk/network */
  masterKey: CryptoKey;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AES_KEY_LENGTH_BITS = 256;
const GCM_IV_LENGTH_BYTES = 12;
const SALT_LENGTH_BYTES = 16;

/** Recommended defaults (OWASP Argon2id guidance, tuned for an interactive desktop/web login) */
export const DEFAULT_ARGON2ID_PARAMS = {
  memoryKiB: 65536, // 64 MiB
  iterations: 3,
  parallelism: 4,
} as const;

/** Fallback used only when Argon2id (WASM) is unavailable in the runtime (e.g. very old browser) */
export const DEFAULT_PBKDF2_PARAMS = {
  iterations: 600_000, // OWASP 2024+ minimum recommendation for PBKDF2-SHA256
} as const;

const AUTH_CONTEXT = "axisvault-auth-v1";
const ENC_CONTEXT = "axisvault-enc-v1";

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(b64, "base64"));
  }
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

/**
 * Newer TypeScript DOM lib types narrow WebCrypto inputs to
 * `Uint8Array<ArrayBuffer>` (i.e. guaranteed non-shared, non-resizable
 * backing memory), but plain `new Uint8Array(n)` / TextEncoder output is
 * typed as `Uint8Array<ArrayBufferLike>`. This helper copies into a
 * freshly allocated, plain `ArrayBuffer`-backed view so every call site
 * satisfies `BufferSource` without resorting to `as any`.
 */
function toArrayBufferView(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(new ArrayBuffer(bytes.length));
  copy.set(bytes);
  return copy as Uint8Array<ArrayBuffer>;
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

function utf8(input: string): Uint8Array {
  return new TextEncoder().encode(input);
}

/** Wipe a Uint8Array's contents in place. Best-effort — JS GC means this isn't a hard guarantee, but it shrinks the window a leaked memory dump could be useful. */
export function wipeBytes(bytes: Uint8Array): void {
  crypto.getRandomValues(bytes);
  bytes.fill(0);
}

// ---------------------------------------------------------------------------
// KDF parameter generation (called once, at signup)
// ---------------------------------------------------------------------------

export function generateKdfParams(algorithm: KdfAlgorithm = "argon2id"): KdfParams {
  const authSalt = toBase64(randomBytes(SALT_LENGTH_BYTES));
  const encSalt = toBase64(randomBytes(SALT_LENGTH_BYTES));

  if (algorithm === "argon2id") {
    return {
      algorithm,
      memoryKiB: DEFAULT_ARGON2ID_PARAMS.memoryKiB,
      iterations: DEFAULT_ARGON2ID_PARAMS.iterations,
      parallelism: DEFAULT_ARGON2ID_PARAMS.parallelism,
      authSalt,
      encSalt,
      version: 1,
    };
  }

  return {
    algorithm,
    iterations: DEFAULT_PBKDF2_PARAMS.iterations,
    authSalt,
    encSalt,
    version: 1,
  };
}

// ---------------------------------------------------------------------------
// Argon2id / PBKDF2 raw derivation (returns raw key bytes, caller decides usage)
// ---------------------------------------------------------------------------

interface Argon2Browser {
  hash(opts: {
    pass: string;
    salt: string;
    time: number;
    mem: number;
    parallelism: number;
    hashLen: number;
    type: number;
  }): Promise<{ hash: Uint8Array }>;
  ArgonType: { Argon2id: number };
}

let cachedArgon2: Argon2Browser | null = null;

/**
 * Lazily loads the argon2-browser WASM module. Isolated behind a function
 * so environments that only need PBKDF2 (or that have no WASM support,
 * e.g. some locked-down enterprise browsers) never pay the load cost
 * and never fail merely because Argon2id is unavailable.
 */
async function loadArgon2(): Promise<Argon2Browser> {
  if (cachedArgon2) return cachedArgon2;
  try {
    // We import the "bundled" build specifically (not the package's default
    // entry point). The default entry point uses Node's `fs`/`path` to load
    // the .wasm file from disk and falls back to browser `fetch` against a
    // relative URL that bundlers can't statically resolve. The "bundled"
    // variant inlines the compiled WASM as a base64 string instead, which
    // is the only variant that works correctly under Vite/Rollup/webpack
    // without extra loader configuration.
    const mod = await import("argon2-browser/dist/argon2-bundled.min.js");
    const wrapped: Argon2Browser = {
      hash: (opts) => mod.hash(opts),
      ArgonType: mod.ArgonType,
    };
    cachedArgon2 = wrapped;
    return wrapped;
  } catch (err) {
    throw new CryptoUnavailableError(
      "Argon2id is unavailable in this runtime. AxisVault will fall back to PBKDF2-SHA256, " +
        "which is weaker but still meets OWASP minimums.",
      err,
    );
  }
}

export class CryptoUnavailableError extends Error {
  cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "CryptoUnavailableError";
    this.cause = cause;
  }
}

async function deriveRawBits(
  password: string,
  saltB64: string,
  context: string,
  params: KdfParams,
  outputLengthBytes: number,
): Promise<Uint8Array> {
  // Mix the context string into the salt material via HKDF-style domain
  // separation: salt' = salt || context. This guarantees the auth derivation
  // and the encryption derivation produce unrelated outputs even though
  // they start from the same master password.
  const salt = fromBase64(saltB64);
  const domainSeparatedSalt = concatBytes(salt, utf8(context));

  if (params.algorithm === "argon2id") {
    const argon2 = await loadArgon2();
    const { hash } = await argon2.hash({
      pass: password,
      salt: toBase64(domainSeparatedSalt),
      time: params.iterations,
      mem: params.memoryKiB ?? DEFAULT_ARGON2ID_PARAMS.memoryKiB,
      parallelism: params.parallelism ?? DEFAULT_ARGON2ID_PARAMS.parallelism,
      hashLen: outputLengthBytes,
      type: argon2.ArgonType.Argon2id,
    });
    return hash;
  }

  // PBKDF2 fallback via WebCrypto (available in every modern browser/Node/Electron)
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    toArrayBufferView(utf8(password)),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derived = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: toArrayBufferView(domainSeparatedSalt),
      iterations: params.iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    outputLengthBytes * 8,
  );
  return new Uint8Array(derived);
}

// ---------------------------------------------------------------------------
// Public derivation API
// ---------------------------------------------------------------------------

/**
 * Derives BOTH the AuthHash (to send to the server) and the MasterKey
 * (kept in memory only) from the user's master password. Call this once
 * at login/signup; never persist the master password itself.
 */
export async function deriveLoginMaterial(
  masterPassword: string,
  params: KdfParams,
): Promise<{ authHash: string; masterKeyRaw: Uint8Array }> {
  const [authBits, encBits] = await Promise.all([
    deriveRawBits(masterPassword, params.authSalt, AUTH_CONTEXT, params, 32),
    deriveRawBits(masterPassword, params.encSalt, ENC_CONTEXT, params, 32),
  ]);

  return {
    authHash: toBase64(authBits),
    masterKeyRaw: encBits,
  };
}

/** Imports raw derived bytes as a non-extractable AES-GCM CryptoKey. */
export async function importAesKey(rawKey: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    toArrayBufferView(rawKey),
    { name: "AES-GCM", length: AES_KEY_LENGTH_BITS },
    false, // non-extractable: cannot be exfiltrated back out as raw bytes once imported
    ["encrypt", "decrypt"],
  );
}

// ---------------------------------------------------------------------------
// Vault Key generation / wrapping (envelope encryption)
// ---------------------------------------------------------------------------

/** Generates a brand-new random Vault Key. Called exactly once, at account creation. */
export async function generateVaultKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: AES_KEY_LENGTH_BITS }, true, [
    "encrypt",
    "decrypt",
  ]);
}

/** Wraps (encrypts) the Vault Key under the Master Key for storage on the server. */
export async function wrapVaultKey(
  vaultKey: CryptoKey,
  masterKey: CryptoKey,
): Promise<WrappedVaultKey> {
  const rawVaultKey = await crypto.subtle.exportKey("raw", vaultKey);
  const iv = randomBytes(GCM_IV_LENGTH_BYTES);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBufferView(iv) },
    masterKey,
    rawVaultKey,
  );
  return {
    ciphertext: toBase64(new Uint8Array(ciphertext)),
    iv: toBase64(iv),
    v: 1,
    wrappedBy: "masterKey",
  };
}

/** Unwraps (decrypts) the Vault Key using the Master Key derived at login. Throws if the master password was wrong. */
export async function unwrapVaultKey(
  wrapped: WrappedVaultKey,
  masterKey: CryptoKey,
): Promise<CryptoKey> {
  const iv = fromBase64(wrapped.iv);
  const ciphertext = fromBase64(wrapped.ciphertext);
  let rawVaultKey: ArrayBuffer;
  try {
    rawVaultKey = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: toArrayBufferView(iv) },
      masterKey,
      toArrayBufferView(ciphertext),
    );
  } catch {
    throw new InvalidMasterPasswordError();
  }
  return crypto.subtle.importKey("raw", rawVaultKey, { name: "AES-GCM", length: AES_KEY_LENGTH_BITS }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export class InvalidMasterPasswordError extends Error {
  constructor() {
    super("Unable to unlock vault: master password is incorrect or vault data is corrupted.");
    this.name = "InvalidMasterPasswordError";
  }
}

// ---------------------------------------------------------------------------
// Item-level encryption (every credential field, every folder name, etc.)
// ---------------------------------------------------------------------------

/**
 * Encrypts arbitrary JSON-serializable data with the Vault Key.
 * Used for every vault item: login credentials, secure notes, card
 * details, folder names — anything that must never reach the server
 * as plaintext.
 */
export async function encryptJson<T>(data: T, vaultKey: CryptoKey): Promise<EncryptedBlob> {
  const plaintext = utf8(JSON.stringify(data));
  const iv = randomBytes(GCM_IV_LENGTH_BYTES);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBufferView(iv) },
    vaultKey,
    toArrayBufferView(plaintext),
  );
  return {
    ciphertext: toBase64(new Uint8Array(ciphertext)),
    iv: toBase64(iv),
    v: 1,
  };
}

export async function decryptJson<T>(blob: EncryptedBlob, vaultKey: CryptoKey): Promise<T> {
  const iv = fromBase64(blob.iv);
  const ciphertext = fromBase64(blob.ciphertext);
  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: toArrayBufferView(iv) },
      vaultKey,
      toArrayBufferView(ciphertext),
    );
  } catch {
    throw new VaultDecryptionError();
  }
  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}

export class VaultDecryptionError extends Error {
  constructor() {
    super("Failed to decrypt vault item. The data may be corrupted or tampered with.");
    this.name = "VaultDecryptionError";
  }
}

// ---------------------------------------------------------------------------
// Master password change (re-wrap, don't re-encrypt items)
// ---------------------------------------------------------------------------

/**
 * Re-wraps the existing Vault Key under a newly derived Master Key.
 * This is the entire cost of a master-password change: O(1), not O(items).
 * Returns the new KdfParams (fresh salts), new AuthHash to send to the
 * server, and the newly wrapped Vault Key blob to store server-side.
 */
export async function rotateMasterPassword(
  newMasterPassword: string,
  currentVaultKey: CryptoKey,
  algorithm: KdfAlgorithm = "argon2id",
): Promise<{ kdfParams: KdfParams; authHash: string; wrappedVaultKey: WrappedVaultKey }> {
  const kdfParams = generateKdfParams(algorithm);
  const { authHash, masterKeyRaw } = await deriveLoginMaterial(newMasterPassword, kdfParams);
  const masterKey = await importAesKey(masterKeyRaw);
  wipeBytes(masterKeyRaw);
  const wrappedVaultKey = await wrapVaultKey(currentVaultKey, masterKey);
  return { kdfParams, authHash, wrappedVaultKey };
}

// ---------------------------------------------------------------------------
// Password generator
// ---------------------------------------------------------------------------

export interface PasswordGeneratorOptions {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
  /** Excludes visually ambiguous characters: 0/O, 1/l/I, etc. */
  excludeAmbiguous?: boolean;
}

const CHAR_SETS = {
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  numbers: "0123456789",
  symbols: "!@#$%^&*()_+-=[]{}|;:,.<>?",
  ambiguous: new Set(["0", "O", "1", "l", "I", "|"]),
};

/** Cryptographically secure password generation using rejection sampling to avoid modulo bias. */
export function generatePassword(options: PasswordGeneratorOptions): string {
  let pool = "";
  if (options.uppercase) pool += CHAR_SETS.uppercase;
  if (options.lowercase) pool += CHAR_SETS.lowercase;
  if (options.numbers) pool += CHAR_SETS.numbers;
  if (options.symbols) pool += CHAR_SETS.symbols;

  if (options.excludeAmbiguous) {
    pool = [...pool].filter((c) => !CHAR_SETS.ambiguous.has(c)).join("");
  }

  if (pool.length === 0) {
    throw new Error("At least one character set must be enabled.");
  }

  const result: string[] = [];
  const maxValid = 256 - (256 % pool.length); // rejection sampling bound to avoid modulo bias

  while (result.length < options.length) {
    const byte = randomBytes(1)[0];
    if (byte >= maxValid) continue; // reject biased values
    result.push(pool[byte % pool.length]);
  }

  return result.join("");
}

export interface PassphraseOptions {
  wordCount: number;
  separator: string;
  capitalize?: boolean;
  includeNumber?: boolean;
}

/** Generates a memorable passphrase from a wordlist (caller supplies the list, e.g. EFF large wordlist). */
export function generatePassphrase(wordlist: string[], options: PassphraseOptions): string {
  if (wordlist.length < 1000) {
    throw new Error("Wordlist too small for adequate entropy; use a list of 1000+ words (e.g. EFF large wordlist).");
  }
  const words: string[] = [];
  for (let i = 0; i < options.wordCount; i++) {
    const idx = randomIndexBelow(wordlist.length);
    let word = wordlist[idx];
    if (options.capitalize) word = word[0].toUpperCase() + word.slice(1);
    words.push(word);
  }
  if (options.includeNumber) {
    words.push(String(randomIndexBelow(100)).padStart(2, "0"));
  }
  return words.join(options.separator);
}

function randomIndexBelow(max: number): number {
  const range = Math.ceil(max / 256) * 256;
  let value: number;
  do {
    value = randomBytes(1)[0];
  } while (value >= range);
  return value % max;
}

// ---------------------------------------------------------------------------
// Password strength estimation (lightweight, local — never sent anywhere)
// ---------------------------------------------------------------------------

export interface StrengthEstimate {
  score: 0 | 1 | 2 | 3 | 4; // 0=very weak .. 4=very strong
  entropyBits: number;
  feedback: string[];
}

export function estimateStrength(password: string): StrengthEstimate {
  const feedback: string[] = [];
  let charsetSize = 0;
  if (/[a-z]/.test(password)) charsetSize += 26;
  if (/[A-Z]/.test(password)) charsetSize += 26;
  if (/[0-9]/.test(password)) charsetSize += 10;
  if (/[^a-zA-Z0-9]/.test(password)) charsetSize += 32;

  const entropyBits = password.length * Math.log2(Math.max(charsetSize, 1));

  if (password.length < 8) feedback.push("Use at least 8 characters; 16+ is recommended.");
  if (!/[A-Z]/.test(password)) feedback.push("Add an uppercase letter.");
  if (!/[0-9]/.test(password)) feedback.push("Add a number.");
  if (!/[^a-zA-Z0-9]/.test(password)) feedback.push("Add a symbol.");
  if (/^(.)\1+$/.test(password)) feedback.push("Avoid repeating the same character.");

  let score: StrengthEstimate["score"];
  if (entropyBits < 28) score = 0;
  else if (entropyBits < 36) score = 1;
  else if (entropyBits < 60) score = 2;
  else if (entropyBits < 80) score = 3;
  else score = 4;

  return { score, entropyBits: Math.round(entropyBits), feedback };
}

export { toBase64, fromBase64 };
