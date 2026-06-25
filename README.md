# AxisVault

A **zero-knowledge** password manager and credential vault. The server never sees a plaintext password, vault item, or encryption key — all encryption happens client-side before anything touches the network.

Built as a full-stack TypeScript monorepo with a React web app, Express + PostgreSQL backend, and an optional Electron desktop wrapper — all sharing the same cryptographic core.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Zero-Knowledge Architecture](#zero-knowledge-architecture)
- [Repository Structure](#repository-structure)
- [Prerequisites](#prerequisites)
- [Local Development Setup](#local-development-setup)
- [Environment Variables Reference](#environment-variables-reference)
- [npm Scripts Reference](#npm-scripts-reference)
- [Building for Production](#building-for-production)
- [API Endpoints](#api-endpoints)
- [Database Schema](#database-schema)
- [Security Model](#security-model)
- [Extending AxisVault](#extending-axisvault)
- [Troubleshooting](#troubleshooting)

---

## Features

- **Zero-knowledge encryption** — AES-256-GCM vault encryption, Argon2id key derivation; the server stores only ciphertext and never sees plaintext data
- **Login vault** — store usernames, passwords, URIs, TOTP seeds, and custom fields per entry
- **API key vault** — store API keys with header name, auth scheme, service URL, and expiry date tracking
- **Organized sections** — Logins and API Keys displayed in clearly labelled, separate sections in the UI
- **Password generator** — configurable length and character sets with a live strength meter
- **Auto-lock** — configurable inactivity timeout; vault key is wiped from memory on lock
- **Master password rotation** — re-wraps the vault key under the new password without re-encrypting all items
- **Encrypted export** — full vault backup including the wrapped vault key and KDF params for offline recovery
- **Dark / light theme** — warm amber-and-teal dark theme ("Forge") + warm cream light theme ("Parchment") with futuristic CSS animations; persisted across sessions
- **Desktop app** — same React build loaded in Electron for a native-feeling experience on Windows, macOS, and Linux

---

## Tech Stack

### Frontend (`packages/web`)

| Technology | Role |
|---|---|
| [React 18](https://react.dev) | UI framework |
| [TypeScript 5](https://www.typescriptlang.org) | Type safety across all packages |
| [Vite 5](https://vitejs.dev) | Dev server + bundler (ES modules for web, IIFE bundle for Electron) |
| [React Router DOM v6](https://reactrouter.com) | Client-side routing with auth/session route guards |
| [Zustand](https://zustand-demo.pmnd.rs) | Lightweight state management (`authStore` + `vaultStore`) |
| [Lucide React](https://lucide.dev) | Icon library |
| CSS Custom Properties | Design token system — no Tailwind, no CSS-in-JS |
| [JetBrains Mono](https://www.jetbrains.com/lp/mono/) | Monospace font for data labels and code-like UI |
| WebCrypto API (`crypto.subtle`) | Native browser AES-256-GCM encryption and decryption |
| [argon2-browser](https://github.com/antelle/argon2-browser) | WASM Argon2id for client-side key derivation |

### Backend (`packages/server`)

| Technology | Role |
|---|---|
| [Node.js 20+](https://nodejs.org) | Server runtime |
| [Express 4](https://expressjs.com) | HTTP framework |
| [PostgreSQL 14+](https://www.postgresql.org) | Primary database (stores ciphertext only) |
| [pg](https://node-postgres.com) | PostgreSQL client (raw SQL, no ORM) |
| [node-argon2](https://github.com/ranisalt/node-argon2) | Server-side re-hashing of the client auth hash before storage |
| [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) | JWT access + refresh token issuance and validation |
| [Zod](https://zod.dev) | Request body and query parameter validation |
| [Pino](https://getpino.io) | Structured JSON logging with sensitive-field redaction |
| [Helmet](https://helmetjs.github.io) | Security response headers |
| [express-rate-limit](https://github.com/express-rate-limit/express-rate-limit) | Rate limiting on authentication routes |
| [CORS](https://github.com/expressjs/cors) | Cross-origin request handling |

### Shared (`packages/shared`)

| Technology | Role |
|---|---|
| TypeScript | Shared type definitions used by all packages |
| WebCrypto API | Portable `crypto.subtle` wrappers (runs in browser and Electron renderer) |
| argon2-browser | WASM Argon2id — runs only on the client, never on the server |

### Desktop (`packages/desktop`)

| Technology | Role |
|---|---|
| [Electron](https://www.electronjs.org) | Native app shell |
| [Electron Builder](https://www.electron.build) | Cross-platform packaging and installer generation |
| TypeScript | Main process and preload (IPC bridge) scripts |

---

## Zero-Knowledge Architecture

```
Master Password  (user types this — never transmitted, never stored anywhere)
        │
        ├─ Argon2id(pw, saltA, context="axisvault-auth-v1")  →  AuthHash
        │         sent to server at login
        │         → server re-hashes with its own Argon2id pass → stored in DB
        │
        └─ Argon2id(pw, saltB, context="axisvault-enc-v1")   →  MasterKey
                         │                                        (lives in memory only,
                         │                                         never transmitted)
                         └─ unwraps  →  VaultKey
                                          │   (random AES-256 key, generated once at signup;
                                          │    stored server-side only in its wrapped/encrypted form)
                                          │
                                          └─ AES-256-GCM encrypts every vault item
                                             before it is sent to the server
```

**Two independent Argon2id derivations from the same password:**
- `saltA` and `saltB` are different random salts generated at signup; different context strings also prevent any relationship between the two outputs
- `AuthHash` (what the server uses to verify identity) is cryptographically unrelated to `MasterKey` (what decrypts the vault) — a full database dump cannot be used to decrypt vault data
- The server re-hashes `AuthHash` with its own Argon2id pass before storage, so a database leak still requires cracking a high-cost hash, not simply replaying a stolen value

**VaultKey lifecycle:**
- Generated randomly at signup (never derived from the password)
- Wrapped (AES-GCM encrypted) under `MasterKey` and stored server-side in that form
- On login: client downloads the wrapped key, derives `MasterKey`, unwraps `VaultKey` in memory
- `MasterKey` is wiped from memory immediately after the unwrap
- Changing master password re-wraps the same `VaultKey` under a new `MasterKey` — vault items do not need to be re-encrypted

**In-memory security:**
- On auto-lock or manual lock: `VaultKey` reference is dropped and the decrypted item cache is cleared — only ciphertext remains in memory after locking
- The vault key is never written to `localStorage`, `sessionStorage`, or disk
- The session KDF params and wrapped vault key (both safe to cache) are stored in `sessionStorage` to allow re-unlock without a server round-trip after inactivity lock

---

## Repository Structure

```
axisvault/
├── packages/
│   ├── shared/                     # Crypto core + shared TypeScript types
│   │   └── src/
│   │       ├── crypto.ts           # AES-256-GCM, Argon2id wrappers, vault key rotation
│   │       ├── types.ts            # VaultItem types, API request/response contracts
│   │       └── index.ts            # Public exports
│   │
│   ├── server/                     # Express + PostgreSQL API server
│   │   ├── .env.example            # Environment variable template (copy to .env)
│   │   └── src/
│   │       ├── app.ts              # Express setup: middleware, routes, error handler
│   │       ├── config.ts           # Environment variable loading and validation
│   │       ├── logger.ts           # Pino logger with field redaction
│   │       ├── auth/
│   │       │   └── tokens.ts       # JWT issuance and verification
│   │       ├── routes/
│   │       │   ├── auth.ts         # /api/auth/* HTTP handlers
│   │       │   ├── vault.ts        # /api/vault/* HTTP handlers
│   │       │   └── schemas.ts      # Zod validation schemas for all routes
│   │       ├── services/
│   │       │   ├── authService.ts  # User creation, login, password rotation, token validation
│   │       │   └── vaultService.ts # Item/folder sync logic (push/pull/export)
│   │       ├── middleware/
│   │       │   ├── requireAuth.ts  # JWT Bearer token verification middleware
│   │       │   └── errorHandler.ts # Centralized error formatting
│   │       └── db/
│   │           ├── pool.ts             # PostgreSQL connection pool
│   │           ├── migrate.ts          # Migration runner (applies *.sql files in order)
│   │           └── migrations/
│   │               └── 001_init.sql    # Full schema: users, tokens, vault, sync, audit
│   │
│   ├── web/                        # React SPA — the vault UI
│   │   ├── index.html
│   │   ├── vite.config.ts          # Vite config (dual web/Electron build modes)
│   │   ├── .env.electron           # Electron-specific Vite env (tracked — no secrets)
│   │   └── src/
│   │       ├── main.tsx            # React entry point + pre-mount theme application
│   │       ├── App.tsx             # BrowserRouter/HashRouter + route definitions
│   │       ├── pages/
│   │       │   ├── LoginPage.tsx
│   │       │   ├── SignupPage.tsx
│   │       │   ├── VaultPage.tsx   # Main vault UI (item list + detail panel)
│   │       │   ├── LockScreen.tsx  # Auto-lock + session expiry screen
│   │       │   ├── SettingsPage.tsx
│   │       │   └── ExportPage.tsx  # Encrypted vault export
│   │       ├── components/
│   │       │   ├── ItemList.tsx    # Sidebar list with Login / API Key sections
│   │       │   ├── ItemDetail.tsx  # Create/view/edit panel for all item types
│   │       │   ├── Sidebar.tsx     # Nav + folder list + theme toggle
│   │       │   ├── RouteGuards.tsx # RequireUnlockedVault, RequireAuthenticated, RedirectIfAuthenticated
│   │       │   ├── PasswordGenerator.tsx
│   │       │   ├── StrengthMeter.tsx
│   │       │   ├── VaultDialIcon.tsx
│   │       │   └── ui.tsx          # Shared primitive components (Button, Input, Field, Card)
│   │       ├── store/
│   │       │   ├── authStore.ts    # Zustand: tokens, vault key, lock state, auto-lock
│   │       │   └── vaultStore.ts   # Zustand: decrypted items, folders, sync
│   │       ├── hooks/
│   │       │   ├── useAutoLock.ts  # Inactivity timer — locks vault after configured timeout
│   │       │   └── useTheme.ts     # Dark/light theme with localStorage persistence
│   │       ├── lib/
│   │       │   ├── apiClient.ts    # Fetch wrapper with JWT refresh + session expiry handling
│   │       │   └── electronBridge.d.ts  # Type definitions for Electron IPC bridge
│   │       └── styles/
│   │           └── tokens.css      # All CSS custom properties (design tokens + animations)
│   │
│   └── desktop/                    # Electron shell
│       ├── tsconfig.main.json      # TypeScript config for main + preload (CommonJS)
│       ├── build/
│       │   ├── icon.ico            # Windows app icon
│       │   ├── icon.png            # Linux app icon
│       │   ├── icon.icns           # macOS app icon (not in repo — generate with script)
│       │   └── generate-icns.sh    # Script to generate .icns from .png (macOS only)
│       └── src/
│           ├── main/main.ts        # Electron main process (BrowserWindow, app lifecycle)
│           └── preload/preload.ts  # Preload script — contextBridge IPC exposure
│
├── scripts/
│   └── start-server.sh             # Helper to daemonize the server on Linux/macOS
├── package.json                    # Monorepo root: npm workspaces + shared scripts
└── package-lock.json
```

---

## Prerequisites

| Requirement | Minimum Version | Check |
|---|---|---|
| [Node.js](https://nodejs.org) | **20.0.0** | `node -v` |
| npm | **10.0.0** | `npm -v` (included with Node 20) |
| [PostgreSQL](https://www.postgresql.org/download/) | **14** | `psql --version` |
| Git | Any recent version | `git --version` |

**Installing PostgreSQL:**

- **Windows:** [Official installer](https://www.postgresql.org/download/windows/) or `scoop install postgresql`
- **macOS:** `brew install postgresql@16 && brew services start postgresql@16`
- **Ubuntu/Debian:** `sudo apt install postgresql && sudo systemctl start postgresql`

After installation, ensure `psql` and `createdb` are available on your `PATH`. On Windows you may need to add PostgreSQL's `bin/` directory to System Environment Variables.

---

## Local Development Setup

### 1. Clone the repository

```bash
git clone <repository-url>
cd axisvault
```

### 2. Install all dependencies

```bash
npm install
```

This installs dependencies for every workspace (`packages/shared`, `packages/server`, `packages/web`, `packages/desktop`) in a single command via npm workspaces.

### 3. Build the shared package

`@axisvault/shared` is consumed as compiled JavaScript by the other packages — its `dist/` folder must exist before anything else can start.

```bash
npm run build:shared
```

Or run everything at once with the convenience script:

```bash
npm run setup
```

`npm run setup` runs `npm install`, builds `@axisvault/shared`, and builds `@axisvault/server` — safe to run multiple times.

### 4. Create the PostgreSQL database

```bash
createdb axisvault
```

Or using `psql`:

```bash
psql -U postgres -c "CREATE DATABASE axisvault;"
```

If you want a dedicated database user (recommended):

```bash
psql -U postgres -c "CREATE USER axisvault WITH PASSWORD 'yourpassword';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE axisvault TO axisvault;"
```

### 5. Configure environment variables

```bash
cp packages/server/.env.example packages/server/.env
```

Open `packages/server/.env` and fill in the required values. At minimum:

```env
DATABASE_URL=postgresql://axisvault:yourpassword@localhost:5432/axisvault
JWT_ACCESS_SECRET=<generate-below>
JWT_REFRESH_SECRET=<generate-below>
```

Generate cryptographically secure JWT secrets:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

Run this command twice and use the two outputs as `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`. They must be different values.

See the full [Environment Variables Reference](#environment-variables-reference) for all available options.

### 6. Run database migrations

```bash
npm run migrate
```

This builds the server and applies all SQL migration files in `packages/server/src/db/migrations/` in order. Safe to re-run — migrations use `IF NOT EXISTS` guards.

### 7. Start the backend

```bash
npm run dev:server
```

The API server starts at **http://localhost:4000**. This command watches for changes in both `packages/shared` and `packages/server` and reloads automatically.

Verify it's running:

```bash
curl http://localhost:4000/api/health
# or open http://localhost:4000 in a browser
```

### 8. Start the web app

```bash
npm run dev:web
```

The React app starts at **http://localhost:5173**. Vite proxies all `/api` requests to `http://localhost:4000`, so there are no CORS issues in development.

Open [http://localhost:5173](http://localhost:5173), create an account, and start using the vault.

### 9. (Optional) Start the desktop app

> Requires the backend (step 7) to be running. The Electron dev build points at `http://localhost:5173`, so the Vite dev server (step 8) must also be running.

```bash
cd packages/desktop
npm run dev
```

This compiles the Electron main process and launches the app pointed at `http://localhost:5173`.

---

## Environment Variables Reference

All variables live in `packages/server/.env`. Start from the provided template:

```bash
cp packages/server/.env.example packages/server/.env
```

### Server (`packages/server/.env`)

| Variable | Default | Required | Description |
|---|---|---|---|
| `NODE_ENV` | `development` | No | `development` or `production`. Controls log format and error verbosity. |
| `PORT` | `4000` | No | Port the Express server listens on. |
| `DATABASE_URL` | — | **Yes** | Full PostgreSQL connection string. Format: `postgresql://user:password@host:port/dbname` |
| `DB_SSL` | `false` | No | Set `true` when connecting to a managed PostgreSQL service (AWS RDS, Supabase, Railway, etc.) that requires SSL. |
| `DB_POOL_MAX` | `10` | No | Maximum connections in the PostgreSQL pool. |
| `JWT_ACCESS_SECRET` | — | **Yes** | Secret for signing access tokens. Min 32 characters. Must differ from `JWT_REFRESH_SECRET`. |
| `JWT_REFRESH_SECRET` | — | **Yes** | Secret for signing refresh tokens. Min 32 characters. |
| `JWT_ACCESS_TTL` | `15m` | No | Access token lifetime. Short values (15 minutes) are recommended — the client refreshes transparently. |
| `JWT_REFRESH_TTL_DAYS` | `30` | No | Refresh token lifetime in days. |
| `CORS_ORIGIN` | `http://localhost:5173` | No | Allowed CORS origin. Set to your production web app domain in production. |
| `ALLOW_NULL_ORIGIN` | `false` | No | Set `true` to accept requests from Electron (Electron's `file://` pages send `Origin: null`). Do not enable on a shared server without understanding the security implications. |
| `SERVER_ARGON2_MEMORY_KIB` | `19456` | No | Argon2id memory cost for server-side auth hash re-hashing (~19 MiB). Tune to your server hardware. |
| `SERVER_ARGON2_TIME_COST` | `2` | No | Argon2id iteration count for server-side hashing. |
| `SERVER_ARGON2_PARALLELISM` | `1` | No | Argon2id parallelism for server-side hashing. |
| `RATE_LIMIT_AUTH_MAX` | `10` | No | Max requests to auth endpoints per IP per window. |
| `RATE_LIMIT_AUTH_WINDOW_MS` | `900000` | No | Rate limit window in milliseconds (default: 15 minutes). |

### Web app (`packages/web`)

The web app reads a single Vite environment variable at **build time** only. In development the API is always proxied and this variable is unused.

| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE_URL` | (empty — uses relative `/api`) | Full API origin for production and Electron builds. Example: `https://api.yourdomain.com` |

This variable is pre-set for the Electron build in `packages/web/.env.electron` (intentionally tracked in git — it contains no secrets).

---

## npm Scripts Reference

Run all scripts from the **repository root** unless otherwise noted.

| Script | Description |
|---|---|
| `npm run setup` | Install deps + build shared + build server. Run once after cloning. |
| `npm run dev:server` | Start backend in watch mode (auto-rebuilds shared + server on change). API at http://localhost:4000 |
| `npm run dev:web` | Start Vite dev server (auto-rebuilds shared on change). App at http://localhost:5173 |
| `npm run dev:shared` | Watch and rebuild only `packages/shared` |
| `npm run dev:desktop` | Launch Electron in dev mode (requires backend + Vite dev server running) |
| `npm run build:shared` | Compile `packages/shared` → `packages/shared/dist/` |
| `npm run build:server` | Build shared + compile `packages/server` → `packages/server/dist/` |
| `npm run build:web` | Build shared + Vite production bundle → `packages/web/dist/` |
| `npm run build:desktop` | Build shared + Electron renderer + main process |
| `npm run migrate` | Build server + apply all pending SQL migrations |
| `npm run test:shared` | Run Jest tests for the shared crypto package |

---

## Building for Production

### Web

```bash
npm run build:web
```

Output: `packages/web/dist/`

Deploy the contents of `packages/web/dist/` to any static host (Vercel, Netlify, AWS S3 + CloudFront, nginx, etc.). All routes must serve `index.html` for client-side routing to work.

**Example nginx configuration:**

```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;
    root /var/www/axisvault;
    index index.html;

    # Serve SPA — all unknown paths fall back to index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to the backend
    location /api/ {
        proxy_pass http://localhost:4000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Running the production server:**

```bash
npm run build:server

# Set NODE_ENV=production in packages/server/.env
node packages/server/dist/index.js
```

Using PM2 for process management:

```bash
npm install -g pm2
pm2 start packages/server/dist/index.js --name axisvault-api
pm2 save && pm2 startup
```

### Desktop — Windows

```bash
cd packages/desktop
npm run build          # Builds renderer (Electron Vite mode) + main process
npm run package:win    # Produces NSIS installer in packages/desktop/release/
```

> **Code signing:** Without a certificate, Windows SmartScreen will show an "unidentified publisher" warning. To sign: set `CSC_LINK` (path to your `.pfx` file) and `CSC_KEY_PASSWORD` before packaging.

### Desktop — macOS

```bash
# Generate the .icns icon (macOS only — requires iconutil)
bash packages/desktop/build/generate-icns.sh

cd packages/desktop
npm run build
npm run package:mac    # Produces a .dmg in packages/desktop/release/
```

> **Notarization:** Required for distribution outside the Mac App Store. Set `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID`, then configure the `notarize` hook in `electron-builder.yml`.

### Desktop — Linux

```bash
cd packages/desktop
npm run build
npm run package:linux  # Produces AppImage in packages/desktop/release/
```

**Important:** `npm run build` inside `packages/desktop` overwrites `packages/web/dist/` with an Electron-specific bundle (IIFE format, `HashRouter`, relative asset paths). If you need both a web deployment and a desktop package, rebuild the web bundle afterward:

```bash
npm run build:web    # Restores packages/web/dist/ to the standard web bundle
```

**Why the Electron build is different from the web build:**

| Aspect | Web build | Electron build |
|---|---|---|
| Router | `BrowserRouter` | `HashRouter` (no server to resolve paths under `file://`) |
| Bundle format | ES modules | IIFE (Chromium blocks ES module `import` over `file://`) |
| Asset paths | Absolute (`/assets/…`) | Relative (`./assets/…`) |
| API base URL | Relative `/api` (proxied by nginx) | Full URL from `VITE_API_BASE_URL` |

---

## API Endpoints

All endpoints are prefixed with `/api`. Auth routes are rate-limited to 10 requests per 15 minutes per IP by default.

### Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/signup` | None | Create an account. Body: `{ email, authHash, kdfParams, wrappedVaultKey }` |
| `GET` | `/api/auth/kdf-params` | None | Fetch KDF params for a given email (`?email=`). Required before login to derive the correct `authHash`. |
| `POST` | `/api/auth/login` | None | Authenticate. Body: `{ email, authHash }`. Returns access token, refresh token, KDF params, and wrapped vault key. |
| `POST` | `/api/auth/refresh` | None | Rotate refresh token. Body: `{ refreshToken }`. Returns new token pair. Reuse of a rotated token revokes the entire family. |
| `POST` | `/api/auth/logout` | Bearer | Revoke the current refresh token. Body: `{ refreshToken }` |
| `PUT` | `/api/auth/change-password` | Bearer | Rotate master password. Accepts current auth hash + new auth hash + new wrapped vault key. |

### Vault

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/vault/pull` | Bearer | Fetch all encrypted items and folders. Supports incremental sync via `syncToken`. |
| `POST` | `/api/vault/push` | Bearer | Push encrypted item and folder changes. Uses `baseSyncToken` for optimistic concurrency conflict detection. |
| `GET` | `/api/vault/export` | Bearer | Export the complete encrypted vault: items, folders, wrapped vault key, and KDF params. |

> All vault payloads are AES-256-GCM ciphertext. The server cannot read vault contents.

---

## Database Schema

Managed by raw SQL files in `packages/server/src/db/migrations/`. The migration runner tracks applied files and only runs new ones.

### Tables

| Table | Description |
|---|---|
| `users` | Accounts: email (`CITEXT`), server-hashed auth hash (Argon2id), KDF params (`JSONB`), wrapped vault key, account lock state |
| `refresh_tokens` | Active refresh tokens: hashed token value, device label, IP, user-agent, expiry, revoked flag |
| `folders` | Encrypted folder hierarchy: `payload` is AES-256-GCM ciphertext of `{ name }` |
| `vault_items` | Encrypted credentials: `payload` is AES-256-GCM ciphertext of `{ name, data, favorite }` |
| `sync_clocks` | Per-user monotonic counter used for incremental sync and conflict detection |
| `audit_log` | Security event log: login attempts, password changes, exports — vault contents are never logged |

The `payload` columns in `folders` and `vault_items` are opaque binary blobs to the server — it stores, retrieves, and syncs them without ever decoding them.

---

## Security Model

### What the server stores

| Data | Form stored |
|---|---|
| Email address | Plaintext (required for login lookup) |
| Auth hash | Argon2id hash (server re-hashes the client-derived value) |
| KDF parameters (salts + cost factors) | Plaintext JSONB — not secret; needed by the client before login |
| Wrapped vault key | AES-GCM ciphertext (encrypted under `MasterKey` which the server never sees) |
| Vault items | AES-256-GCM ciphertext |
| Folder names | AES-256-GCM ciphertext |
| Refresh tokens | SHA-256 hash |

### What the server never stores

- The master password (never transmitted)
- `MasterKey` (derived client-side, never transmitted)
- `VaultKey` in plaintext (only its wrapped, encrypted form is stored)
- Any plaintext vault field: passwords, usernames, URLs, API keys, notes, TOTP seeds

### Session security

- **Access tokens:** short-lived JWTs (default 15 minutes). Verified from the JWT signature alone — no database lookup on each request.
- **Refresh tokens:** long-lived (default 30 days), stored as SHA-256 hashes. Each use issues a new token pair and marks the old one used. Presenting a previously rotated token triggers revocation of the entire token family (refresh token rotation with reuse detection).
- **Auto-lock:** client-side only. After the configured inactivity period, the `VaultKey` is dropped from memory and the decrypted item cache is cleared. The server is not involved. Re-unlock re-derives the `VaultKey` from the cached wrapped key in `sessionStorage` — no server round-trip needed.
- **Session expiry:** when the server rejects a token refresh (expired or revoked), the client clears all local auth state and navigates to the login page.

### HTTPS requirement

Always deploy behind HTTPS in production. Without TLS, the `authHash` can be captured in transit and replayed for login (though it still cannot decrypt the vault). Use nginx, Caddy, or Cloudflare Tunnel to terminate TLS in front of the Node server.

---

## Extending AxisVault

### Adding a new vault item type

1. Add a new interface in `packages/shared/src/types.ts` and add it to the `VaultItemData` and `VaultItemType` unions
2. Add a form and type picker card in `packages/web/src/components/ItemDetail.tsx`
3. Add a section header in `packages/web/src/components/ItemList.tsx` if the type warrants its own section
4. No server changes needed — the payload is encrypted and opaque to the server

### Security rules for contributors

- **Never import `@axisvault/shared`'s crypto module from server code.** The server must never have access to key material or plaintext vault data — this is the core of the zero-knowledge model.
- **Never log request bodies on auth or vault routes.** Pino's field redaction is defense-in-depth, not a substitute for not logging sensitive paths.
- **New private vault fields belong inside the encrypted `payload` blob,** not as new plaintext database columns.
- **Do not store the vault key, master key, or any plaintext vault data in `localStorage`.** Only `sessionStorage` is acceptable for the wrapped vault key and KDF params (both are already available server-side and contain no secret key material on their own).

---

## Troubleshooting

### `ERR_MODULE_NOT_FOUND …@axisvault/shared/dist/index.js`

`@axisvault/shared` is consumed as compiled JavaScript — `dist/` is not tracked in the repo. Run:

```bash
npm run setup
# or just:
npm run build:shared
```

### `Cannot find module '…dist/db/migrate.js'`

The server TypeScript must be compiled before the migration runner can execute. Run:

```bash
npm run migrate
```

This script builds the server first, then runs migrations.

### API calls return `ECONNREFUSED`

The backend isn't running. Start it with:

```bash
npm run dev:server
```

Confirm it's listening: `curl http://localhost:4000`

### `password authentication failed for user "postgres"` (PostgreSQL)

The credentials in `DATABASE_URL` don't match your PostgreSQL setup. Create a dedicated database user:

```bash
psql -U postgres -c "CREATE USER axisvault WITH PASSWORD 'yourpassword';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE axisvault TO axisvault;"
```

Then update `DATABASE_URL` in `packages/server/.env`:

```
DATABASE_URL=postgresql://axisvault:yourpassword@localhost:5432/axisvault
```

### "Session expired" appears on every fresh page load

The unlock material (`kdfParams` and `wrappedVaultKey`) is stored in `sessionStorage`, which browsers clear when the tab or window is closed. On reopen, the app correctly prompts for the master password — it cannot re-derive the vault key without it. This is expected behavior.

### Electron app shows `ERR_CONNECTION_REFUSED`

The Electron dev build loads `http://localhost:5173`. Both the Vite dev server and the backend must be running:

```bash
# Terminal 1
npm run dev:server

# Terminal 2
npm run dev:web

# Terminal 3
cd packages/desktop && npm run dev
```

### macOS `package:mac` fails — missing icon.icns

`packages/desktop/build/icon.icns` is not in the repo (`iconutil` is macOS-only). Generate it on a Mac:

```bash
bash packages/desktop/build/generate-icns.sh
```

### Web and desktop builds conflict in `packages/web/dist/`

`npm run build` inside `packages/desktop` overwrites `packages/web/dist/` with the Electron bundle. To restore the standard web bundle:

```bash
npm run build:web
```
