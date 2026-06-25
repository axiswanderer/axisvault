import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { pinoHttp } from "pino-http";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { authRouter } from "./routes/auth.js";
import { vaultRouter } from "./routes/vault.js";
import { errorHandler, HttpError } from "./middleware/errorHandler.js";

export function createApp() {
  const app = express();

  // Behind a reverse proxy (typical production deployment) — needed for
  // correct req.ip resolution used by rate limiting and audit logging.
  app.set("trust proxy", 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", "data:"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
        },
      },
      hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
      crossOriginResourcePolicy: { policy: "same-site" },
    }),
  );

  app.use(
    cors({
      origin(origin, callback) {
        const allowedOrigins = config.corsOrigin.split(",").map((o) => o.trim());

        // No Origin header at all covers three legitimate, non-malicious
        // cases: (1) same-origin requests proxied through Vite's dev
        // server or a production reverse proxy (the browser only ever
        // talks to its own origin; the proxy-to-backend hop has no
        // browser-enforced Origin), (2) server-to-server / curl / health
        // checks, and (3) Electron's file:// pages, which send the
        // literal string "null". We always allow the missing-origin case
        // — there's no cross-origin browser request to protect against
        // here — and gate the literal "null" string behind
        // ALLOW_NULL_ORIGIN specifically for the Electron desktop build.
        if (!origin) return callback(null, true);
        if (origin === "null" && config.allowNullOrigin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);

        logger.warn({ receivedOrigin: origin, allowedOrigins }, "CORS rejected a request");
        return callback(new HttpError(403, "cors_rejected", `Origin "${origin}" is not allowed to access the API.`));
      },
      credentials: true,
      methods: ["GET", "POST", "PATCH", "DELETE"],
    }),
  );

  app.use(compression());
  app.use(express.json({ limit: "2mb" })); // vault export pushes can be largish; still bounded
  app.use(cookieParser());

  app.use(
    pinoHttp({
      logger,
      redact: ["req.headers.authorization", "req.headers.cookie"],
    }),
  );

  // General API-wide limiter as a backstop; auth routes additionally apply
  // their own tighter limiter (see routes/auth.ts).
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: 120,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/vault", vaultRouter);

  app.use((req, res) => {
    res.status(404).json({ error: "not_found", message: `No route for ${req.method} ${req.path}`, statusCode: 404 });
  });

  app.use(errorHandler);

  return app;
}
