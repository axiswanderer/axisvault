import type {
  SignupRequest,
  SignupResponse,
  LoginRequest,
  LoginResponse,
  RefreshResponse,
  ChangeMasterPasswordRequest,
  SyncPullResponse,
  SyncPushRequest,
  SyncPushResponse,
  ExportBackupResponse,
  ApiError,
  KdfParams,
} from "@axisvault/shared";

// On the web, "/api" is a relative path resolved against the page's own
// origin — correct both in dev (Vite's proxy forwards it to the backend)
// and in a typical production deployment (a reverse proxy in front of the
// API serves it under the same domain). Under Electron's file:// origin,
// there is no domain to resolve "/api" against and no proxy in front of
// it, so the desktop build must point directly at the backend's real
// origin. VITE_API_BASE_URL is injected at desktop build time; it's
// absent (and unused) in the regular web build.
const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

export class ApiRequestError extends Error {
  statusCode: number;
  errorCode: string;
  constructor(apiError: ApiError) {
    super(apiError.message);
    this.statusCode = apiError.statusCode;
    this.errorCode = apiError.error;
  }
}

type TokenGetter = () => { accessToken: string | null; refreshToken: string | null };
type TokenSetter = (tokens: { accessToken: string; refreshToken: string }) => void;
type OnSessionExpired = () => void;

let getTokens: TokenGetter = () => ({ accessToken: null, refreshToken: null });
let setTokens: TokenSetter = () => {};
let onSessionExpired: OnSessionExpired = () => {};

/** Wires the API client to the auth store so it can read/refresh tokens without a circular import. */
export function configureApiClient(handlers: { getTokens: TokenGetter; setTokens: TokenSetter; onSessionExpired: OnSessionExpired }) {
  getTokens = handlers.getTokens;
  setTokens = handlers.setTokens;
  onSessionExpired = handlers.onSessionExpired;
}

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const { refreshToken } = getTokens();
    if (!refreshToken) return null;

    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      onSessionExpired();
      return null;
    }

    const data = (await res.json()) as RefreshResponse;
    setTokens(data);
    return data.accessToken;
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const { accessToken } = getTokens();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401 && retry) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return request<T>(path, options, false);
    }
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  const json = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new ApiRequestError(json as ApiError);
  }

  return json as T;
}

export const api = {
  getKdfParams: (email: string) => request<{ kdfParams: KdfParams }>(`/auth/kdf-params?email=${encodeURIComponent(email)}`, { method: "GET" }),

  signup: (body: SignupRequest) => request<SignupResponse>("/auth/signup", { method: "POST", body: JSON.stringify(body) }),

  login: (body: LoginRequest) => request<LoginResponse>("/auth/login", { method: "POST", body: JSON.stringify(body) }),

  logout: (refreshToken: string) => request<void>("/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken }) }),

  changeMasterPassword: (body: ChangeMasterPasswordRequest) =>
    request<{ message: string }>("/auth/change-master-password", { method: "POST", body: JSON.stringify(body) }),

  syncPull: () => request<SyncPullResponse>("/vault/sync/pull", { method: "GET" }),

  syncPush: (body: SyncPushRequest) => request<SyncPushResponse>("/vault/sync/push", { method: "POST", body: JSON.stringify(body) }),

  deleteItem: (id: string) => request<void>(`/vault/items/${id}`, { method: "DELETE" }),

  deleteFolder: (id: string) => request<void>(`/vault/folders/${id}`, { method: "DELETE" }),

  exportBackup: () => request<ExportBackupResponse>("/vault/export", { method: "GET" }),
};
