import "dotenv/config";
import { z } from "zod";

/** z.coerce.boolean() uses JS truthiness, so the string "false" coerces to `true` — this helper parses env-style booleans correctly. */
const envBoolean = (defaultValue: boolean) =>
  z
    .enum(["true", "false", "1", "0"])
    .optional()
    .transform((v) => (v === undefined ? defaultValue : v === "true" || v === "1"));

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DB_SSL: envBoolean(false),
  DB_POOL_MAX: z.coerce.number().default(10),

  // JWT access tokens are short-lived and signed with a dedicated secret,
  // separate from the refresh token secret, so a leak of one does not
  // compromise the other token family.
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().default(30),

  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  // Electron's file:// renderer sends `Origin: null` on fetch requests —
  // there is no domain to allowlist. This is opt-in and OFF by default;
  // enabling it does NOT open CORS to arbitrary origins, only to requests
  // that present literally no origin (which in practice means "loaded
  // from a local file", i.e. our own packaged desktop app, not a website).
  ALLOW_NULL_ORIGIN: envBoolean(false),

  // Server-side Argon2id cost factor for re-hashing the client's auth hash.
  // Deliberately separate from the client-side Argon2id parameters.
  SERVER_ARGON2_MEMORY_KIB: z.coerce.number().default(19456), // ~19 MiB, OWASP minimum for server-side rehash
  SERVER_ARGON2_TIME_COST: z.coerce.number().default(2),
  SERVER_ARGON2_PARALLELISM: z.coerce.number().default(1),

  RATE_LIMIT_AUTH_MAX: z.coerce.number().default(10),
  RATE_LIMIT_AUTH_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast and loud at boot — never start with an invalid security config.
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  throw new Error("Server misconfigured: check required environment variables.");
}

const env = parsed.data;

export const config = {
  nodeEnv: env.NODE_ENV,
  isProduction: env.NODE_ENV === "production",
  port: env.PORT,

  databaseUrl: env.DATABASE_URL,
  dbSsl: env.DB_SSL,
  dbPoolMax: env.DB_POOL_MAX,

  jwtAccessSecret: env.JWT_ACCESS_SECRET,
  jwtRefreshSecret: env.JWT_REFRESH_SECRET,
  jwtAccessTtl: env.JWT_ACCESS_TTL,
  jwtRefreshTtlDays: env.JWT_REFRESH_TTL_DAYS,

  corsOrigin: env.CORS_ORIGIN,
  allowNullOrigin: env.ALLOW_NULL_ORIGIN,

  serverArgon2: {
    memoryKiB: env.SERVER_ARGON2_MEMORY_KIB,
    timeCost: env.SERVER_ARGON2_TIME_COST,
    parallelism: env.SERVER_ARGON2_PARALLELISM,
  },

  rateLimit: {
    authMax: env.RATE_LIMIT_AUTH_MAX,
    authWindowMs: env.RATE_LIMIT_AUTH_WINDOW_MS,
  },
} as const;
