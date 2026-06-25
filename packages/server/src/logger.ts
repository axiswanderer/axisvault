import pino from "pino";
import { config } from "./config.js";

/**
 * Redaction is defense-in-depth: the server should architecturally never
 * possess plaintext passwords or vault keys, but we redact these field
 * names anyway in case a future contributor accidentally logs a full
 * request body, a derived key, or a token during debugging.
 */
export const logger = pino({
  level: config.isProduction ? "info" : "debug",
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "*.password",
      "*.masterPassword",
      "*.authHash",
      "*.accessToken",
      "*.refreshToken",
      "*.vaultKey",
      "*.masterKey",
      "*.ciphertext",
      "*.payload_ciphertext",
      "*.server_hashed_auth",
    ],
    censor: "[REDACTED]",
  },
});
