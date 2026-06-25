-- AxisVault initial schema
-- Design principle: every column that could contain a plaintext secret
-- instead stores ciphertext + nonce produced client-side. The server
-- and database operator should learn nothing from this schema beyond
-- account existence, item *counts*, and coarse timestamps.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------
CREATE TABLE users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email               CITEXT UNIQUE NOT NULL,

    -- The client sends an Argon2id/PBKDF2-derived "auth hash" (NOT the
    -- master password). We then hash THAT again server-side with Argon2id
    -- before storing it, so a stolen DB does not hand an attacker a value
    -- directly usable to authenticate as the user elsewhere, and adds a
    -- second cost-factor against offline cracking of the stored value.
    server_hashed_auth  TEXT NOT NULL,

    -- KDF parameters the client must use to re-derive keys on every login.
    -- Stored as JSON so we can evolve algorithm/cost without a migration.
    kdf_params          JSONB NOT NULL,

    -- The user's random Vault Key, encrypted ("wrapped") under their
    -- Master Key. The server can never derive the Master Key (it never
    -- receives the master password), so this blob is opaque to us.
    wrapped_vault_key_ciphertext TEXT NOT NULL,
    wrapped_vault_key_iv         TEXT NOT NULL,

    -- Optional encrypted password hint, encrypted client-side (or absent).
    encrypted_hint_ciphertext TEXT,
    encrypted_hint_iv         TEXT,

    mfa_enabled         BOOLEAN NOT NULL DEFAULT FALSE,
    mfa_secret_encrypted TEXT, -- TOTP secret, encrypted at rest with server-side KMS key (see note in auth service)

    failed_login_count  INTEGER NOT NULL DEFAULT 0,
    locked_until         TIMESTAMPTZ,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_email ON users (email);

-- ---------------------------------------------------------------------------
-- Refresh tokens (rotated on every use; supports revocation / device list)
-- ---------------------------------------------------------------------------
CREATE TABLE refresh_tokens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- We store only a SHA-256 hash of the refresh token, never the token
    -- itself, so a DB leak cannot be used to mint sessions.
    token_hash      TEXT NOT NULL UNIQUE,

    device_label    TEXT, -- e.g. "Chrome on Windows", set client-side, plaintext metadata only
    user_agent      TEXT,
    ip_address      INET,

    issued_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ NOT NULL,
    revoked_at      TIMESTAMPTZ,
    replaced_by     UUID REFERENCES refresh_tokens(id)
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens (token_hash);

-- ---------------------------------------------------------------------------
-- Folders (names are ciphertext; only hierarchy/IDs are plaintext)
-- ---------------------------------------------------------------------------
CREATE TABLE folders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id       UUID REFERENCES folders(id) ON DELETE SET NULL,

    payload_ciphertext TEXT NOT NULL, -- encrypted JSON: { name }
    payload_iv         TEXT NOT NULL,

    revision        INTEGER NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ -- soft delete, supports sync tombstones
);

CREATE INDEX idx_folders_user ON folders (user_id);

-- ---------------------------------------------------------------------------
-- Vault items (the credentials themselves — fully opaque to the server)
-- ---------------------------------------------------------------------------
CREATE TABLE vault_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    folder_id       UUID REFERENCES folders(id) ON DELETE SET NULL,

    -- Encrypted JSON blob of { name, data: LoginItemData|CardItemData|..., favorite }
    payload_ciphertext TEXT NOT NULL,
    payload_iv         TEXT NOT NULL,

    revision        INTEGER NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ -- soft delete, supports sync tombstones + recovery
);

CREATE INDEX idx_vault_items_user ON vault_items (user_id);
CREATE INDEX idx_vault_items_folder ON vault_items (folder_id);
CREATE INDEX idx_vault_items_updated ON vault_items (user_id, updated_at);

-- ---------------------------------------------------------------------------
-- Sync clock — gives every push/pull a monotonic logical timestamp per user
-- ---------------------------------------------------------------------------
CREATE TABLE sync_clocks (
    user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    clock           BIGINT NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------------------------
-- Audit log — security-relevant events only, never vault contents
-- ---------------------------------------------------------------------------
CREATE TABLE audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    event_type      TEXT NOT NULL, -- e.g. 'login_success', 'login_failed', 'password_changed', 'export_requested'
    ip_address      INET,
    user_agent      TEXT,
    metadata        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_user ON audit_log (user_id, created_at);
