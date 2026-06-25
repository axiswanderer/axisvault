import type { EncryptedBlob, WrappedVaultKey, KdfParams } from "./crypto.js";

// ---------------------------------------------------------------------------
// Vault item domain types (the DECRYPTED shapes — these never go over the wire)
// ---------------------------------------------------------------------------

export type VaultItemType = "login" | "card" | "note" | "identity" | "apikey";

export interface LoginItemData {
  type: "login";
  username: string;
  password: string;
  totpSeed?: string;
  uris: string[];
  notes?: string;
  customFields?: { label: string; value: string; concealed: boolean }[];
}

export interface CardItemData {
  type: "card";
  cardholderName: string;
  number: string;
  expMonth: string;
  expYear: string;
  cvv: string;
  notes?: string;
}

export interface NoteItemData {
  type: "note";
  content: string;
}

export interface IdentityItemData {
  type: "identity";
  fullName: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
}

export interface ApiKeyItemData {
  type: "apikey";
  /** The secret key value */
  key: string;
  /** HTTP header name, e.g. "Authorization", "X-API-Key" */
  keyHeader?: string;
  /** Value prefix/scheme, e.g. "Bearer", "Token" */
  keyScheme?: string;
  /** The service or endpoint this key grants access to */
  serviceUrl?: string;
  /** ISO date string — when the key expires */
  expiresAt?: string;
  notes?: string;
}

export type VaultItemData = LoginItemData | CardItemData | NoteItemData | IdentityItemData | ApiKeyItemData;

/** The decrypted, in-memory representation of a vault item. Exists only client-side. */
export interface DecryptedVaultItem {
  id: string;
  folderId: string | null;
  name: string;
  data: VaultItemData;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
  /** Mirrors EncryptedVaultItem.revision — tracked client-side so saves send the correct base revision for conflict detection. */
  revision: number;
}

/** The shape actually persisted server-side: everything sensitive is ciphertext. */
export interface EncryptedVaultItem {
  id: string;
  folderId: string | null;
  /** Encrypted JSON blob of { name, data, favorite } */
  payload: EncryptedBlob;
  createdAt: string;
  updatedAt: string;
  /** Monotonic version for conflict detection during sync */
  revision: number;
}

export interface DecryptedFolder {
  id: string;
  name: string;
  parentId: string | null;
}

export interface EncryptedFolder {
  id: string;
  /** Encrypted JSON blob of { name } */
  payload: EncryptedBlob;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Auth API contracts
// ---------------------------------------------------------------------------

export interface SignupRequest {
  email: string;
  authHash: string; // base64 — NOT the master password
  kdfParams: KdfParams;
  wrappedVaultKey: WrappedVaultKey;
  /** Optional encrypted hint blob (e.g. password hint), encrypted client-side or omitted entirely */
  encryptedHint?: EncryptedBlob;
}

export interface SignupResponse {
  userId: string;
  email: string;
}

export interface LoginRequest {
  email: string;
  authHash: string;
  /** TOTP code if MFA is enabled on the account */
  mfaCode?: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  userId: string;
  kdfParams: KdfParams;
  wrappedVaultKey: WrappedVaultKey;
  mfaRequired?: boolean;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

export interface ChangeMasterPasswordRequest {
  /** Current auth hash, to prove the user still controls the existing master password */
  currentAuthHash: string;
  newAuthHash: string;
  newKdfParams: KdfParams;
  newWrappedVaultKey: WrappedVaultKey;
}

// ---------------------------------------------------------------------------
// Vault sync API contracts
// ---------------------------------------------------------------------------

export interface SyncPullResponse {
  items: EncryptedVaultItem[];
  folders: EncryptedFolder[];
  /** Server-side logical clock; clients store this and send it back on the next pull for incremental sync */
  syncToken: string;
}

export interface SyncPushRequest {
  items: EncryptedVaultItem[];
  folders: EncryptedFolder[];
  /** The syncToken the client last observed — used for optimistic-concurrency conflict detection */
  baseSyncToken: string;
}

export interface SyncPushResponse {
  syncToken: string;
  conflicts: { id: string; serverRevision: number }[];
}

export interface ExportBackupResponse {
  /** The entire encrypted vault, still ciphertext, plus the wrapped vault key and KDF params needed to decrypt it offline */
  exportedAt: string;
  kdfParams: KdfParams;
  wrappedVaultKey: WrappedVaultKey;
  items: EncryptedVaultItem[];
  folders: EncryptedFolder[];
  formatVersion: 1;
}

// ---------------------------------------------------------------------------
// Error shape
// ---------------------------------------------------------------------------

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

export * from "./crypto.js";
