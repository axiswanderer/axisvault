import { create } from "zustand";
import {
  generateKdfParams,
  deriveLoginMaterial,
  importAesKey,
  generateVaultKey,
  wrapVaultKey,
  unwrapVaultKey,
  wipeBytes,
  rotateMasterPassword,
  type KdfParams,
  type WrappedVaultKey,
} from "@axisvault/shared";
import { api, configureApiClient } from "../lib/apiClient";

type VaultClearer = () => void;
let clearVaultState: VaultClearer = () => {};

/** Wired from vaultStore.ts to avoid a circular import; called on every lock/logout so decrypted items don't linger in memory after the vault key is gone. */
export function registerVaultClearer(fn: VaultClearer) {
  clearVaultState = fn;
}

export type LockReason = "manual" | "timeout" | "session_expired" | null;

interface AuthState {
  // Persisted across reloads (sessionStorage-ish via localStorage, tokens only — never key material)
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
  email: string | null;

  // NEVER persisted. Lives only in memory, cleared on lock.
  vaultKey: CryptoKey | null;
  isUnlocked: boolean;
  lockReason: LockReason;

  autoLockMinutes: number;
  lastActivityAt: number;

  signup: (email: string, masterPassword: string) => Promise<void>;
  login: (email: string, masterPassword: string) => Promise<void>;
  unlockExisting: (masterPassword: string, kdfParams: KdfParams, wrappedVaultKey: WrappedVaultKey) => Promise<void>;
  lock: (reason: LockReason) => void;
  logout: () => Promise<void>;
  touchActivity: () => void;
  setAutoLockMinutes: (minutes: number) => void;
  changeMasterPassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const TOKEN_STORAGE_KEY = "axisvault.tokens";

function persistTokens(accessToken: string | null, refreshToken: string | null, userId: string | null, email: string | null) {
  if (accessToken && refreshToken) {
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify({ accessToken, refreshToken, userId, email }));
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

function loadPersistedTokens(): { accessToken: string | null; refreshToken: string | null; userId: string | null; email: string | null } {
  try {
    const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!raw) return { accessToken: null, refreshToken: null, userId: null, email: null };
    return JSON.parse(raw);
  } catch {
    return { accessToken: null, refreshToken: null, userId: null, email: null };
  }
}

const persisted = loadPersistedTokens();

export function getCachedUnlockMaterial(): { kdfParams: KdfParams; wrappedVaultKey: WrappedVaultKey } | null {
  try {
    const kdfRaw = sessionStorage.getItem("axisvault.currentKdfParams");
    const wrappedRaw = sessionStorage.getItem("axisvault.wrappedVaultKey");
    if (!kdfRaw || !wrappedRaw) return null;
    return { kdfParams: JSON.parse(kdfRaw), wrappedVaultKey: JSON.parse(wrappedRaw) };
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: persisted.accessToken,
  refreshToken: persisted.refreshToken,
  userId: persisted.userId,
  email: persisted.email,

  vaultKey: null,
  isUnlocked: false,
  lockReason: null,

  autoLockMinutes: Number(localStorage.getItem("axisvault.autoLockMinutes") ?? 5),
  lastActivityAt: Date.now(),

  async signup(email, masterPassword) {
    const kdfParams = generateKdfParams("argon2id");
    const { authHash, masterKeyRaw } = await deriveLoginMaterial(masterPassword, kdfParams);
    const masterKey = await importAesKey(masterKeyRaw);
    wipeBytes(masterKeyRaw);

    const vaultKey = await generateVaultKey();
    const wrappedVaultKey = await wrapVaultKey(vaultKey, masterKey);

    await api.signup({ email, authHash, kdfParams, wrappedVaultKey });
    await get().login(email, masterPassword);
  },

  async login(email, masterPassword) {
    // Zero-knowledge login is necessarily two steps: first fetch the
    // account's KDF parameters (salts + cost factors — not secret), THEN
    // derive the auth hash with those exact parameters. Deriving with the
    // wrong salts produces a different (wrong) authHash even with the
    // correct master password.
    const { kdfParams } = await api.getKdfParams(email);
    const { authHash, masterKeyRaw } = await deriveLoginMaterial(masterPassword, kdfParams);

    const loginResult = await api.login({ email, authHash });

    const masterKey = await importAesKey(masterKeyRaw);
    wipeBytes(masterKeyRaw);
    const vaultKey = await unwrapVaultKey(loginResult.wrappedVaultKey, masterKey);

    persistTokens(loginResult.accessToken, loginResult.refreshToken, loginResult.userId, email);
    sessionStorage.setItem("axisvault.currentKdfParams", JSON.stringify(loginResult.kdfParams));
    sessionStorage.setItem("axisvault.wrappedVaultKey", JSON.stringify(loginResult.wrappedVaultKey));

    set({
      accessToken: loginResult.accessToken,
      refreshToken: loginResult.refreshToken,
      userId: loginResult.userId,
      email,
      vaultKey,
      isUnlocked: true,
      lockReason: null,
      lastActivityAt: Date.now(),
    });
  },

  lock(reason) {
    const { vaultKey } = get();
    // Best-effort: CryptoKey objects can't be "wiped" like raw bytes, but
    // dropping every reference and letting GC reclaim it shrinks the window
    // a memory-inspection attack could exploit. Non-extractable keys also
    // mean this reference is the only path back to the key material.
    void vaultKey;
    set({ vaultKey: null, isUnlocked: false, lockReason: reason });
    // Locking the vault key alone isn't enough — the decrypted item cache
    // in the vault store would otherwise still hold plaintext credentials
    // in memory even though the UI no longer shows them.
    clearVaultState();
  },

  /**
   * Re-derives the vault key from a still-authenticated session (the
   * access/refresh tokens are still valid) without calling /auth/login
   * again. Used when the vault auto-locks after inactivity but the
   * broader session hasn't expired — the user only needs to prove they
   * still know the master password, not re-authenticate from scratch.
   */
  async unlockExisting(masterPassword, kdfParams, wrappedVaultKey) {
    const { masterKeyRaw } = await deriveLoginMaterial(masterPassword, kdfParams);
    const masterKey = await importAesKey(masterKeyRaw);
    wipeBytes(masterKeyRaw);
    const vaultKey = await unwrapVaultKey(wrappedVaultKey, masterKey); // throws InvalidMasterPasswordError on wrong password
    set({ vaultKey, isUnlocked: true, lockReason: null, lastActivityAt: Date.now() });
  },

  async logout() {
    const { refreshToken } = get();
    if (refreshToken) {
      try {
        await api.logout(refreshToken);
      } catch {
        // Best-effort revocation — proceed with local logout regardless.
      }
    }
    persistTokens(null, null, null, null);
    sessionStorage.removeItem("axisvault.currentKdfParams");
    sessionStorage.removeItem("axisvault.wrappedVaultKey");
    clearVaultState();
    set({ accessToken: null, refreshToken: null, userId: null, email: null, vaultKey: null, isUnlocked: false, lockReason: null });
  },

  touchActivity() {
    set({ lastActivityAt: Date.now() });
  },

  setAutoLockMinutes(minutes) {
    localStorage.setItem("axisvault.autoLockMinutes", String(minutes));
    set({ autoLockMinutes: minutes });
  },

  async changeMasterPassword(currentPassword, newPassword) {
    const { vaultKey } = get();
    if (!vaultKey) throw new Error("Vault must be unlocked to change the master password.");

    // We need the CURRENT kdfParams + authHash to authorize the change.
    // These come from the most recent login response, which the UI layer
    // is responsible for caching alongside the store (see useVaultSession).
    const currentParamsRaw = sessionStorage.getItem("axisvault.currentKdfParams");
    if (!currentParamsRaw) throw new Error("Missing current session KDF parameters; please log in again.");
    const currentKdfParams: KdfParams = JSON.parse(currentParamsRaw);

    const { authHash: currentAuthHash } = await deriveLoginMaterial(currentPassword, currentKdfParams);

    const rotated = await rotateMasterPassword(newPassword, vaultKey, "argon2id");
    await api.changeMasterPassword({
      currentAuthHash,
      newAuthHash: rotated.authHash,
      newKdfParams: rotated.kdfParams,
      newWrappedVaultKey: rotated.wrappedVaultKey,
    });

    sessionStorage.setItem("axisvault.currentKdfParams", JSON.stringify(rotated.kdfParams));
  },
}));

configureApiClient({
  getTokens: () => ({ accessToken: useAuthStore.getState().accessToken, refreshToken: useAuthStore.getState().refreshToken }),
  setTokens: ({ accessToken, refreshToken }) => {
    const { userId, email } = useAuthStore.getState();
    persistTokens(accessToken, refreshToken, userId, email);
    useAuthStore.setState({ accessToken, refreshToken });
  },
  onSessionExpired: () => {
    useAuthStore.getState().lock("session_expired");
    persistTokens(null, null, null, null);
    useAuthStore.setState({ accessToken: null, refreshToken: null });
  },
});
