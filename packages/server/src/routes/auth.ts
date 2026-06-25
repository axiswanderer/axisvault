import { Router } from "express";
import rateLimit from "express-rate-limit";
import { asyncHandler, HttpError } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { signupSchema, loginSchema, refreshSchema, changeMasterPasswordSchema, kdfParamsLookupSchema } from "./schemas.js";
import * as authService from "../services/authService.js";
import { config } from "../config.js";

export const authRouter = Router();

// Auth endpoints are the highest-value target for credential stuffing and
// brute force, so they get their own tight rate limit independent of the
// general API limiter.
const authLimiter = rateLimit({
  windowMs: config.rateLimit.authWindowMs,
  limit: config.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "rate_limited", message: "Too many attempts. Please wait before trying again.", statusCode: 429 },
});

function clientIp(req: { ip?: string }): string | null {
  return req.ip ?? null;
}

authRouter.get(
  "/kdf-params",
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email } = kdfParamsLookupSchema.parse(req.query);
    const kdfParams = await authService.getKdfParamsForEmail(email);
    res.status(200).json({ kdfParams });
  }),
);

authRouter.post(
  "/signup",
  authLimiter,
  asyncHandler(async (req, res) => {
    const input = signupSchema.parse(req.body);
    const result = await authService.signup(input);
    res.status(201).json(result);
  }),
);

authRouter.post(
  "/login",
  authLimiter,
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const result = await authService.login(input, clientIp(req), req.headers["user-agent"] ?? null);
    res.status(200).json(result);
  }),
);

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    const result = await authService.refresh(refreshToken, clientIp(req), req.headers["user-agent"] ?? null);
    res.status(200).json(result);
  }),
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    await authService.logout(refreshToken);
    res.status(204).send();
  }),
);

authRouter.post(
  "/change-master-password",
  requireAuth,
  authLimiter,
  asyncHandler(async (req, res) => {
    if (!req.userId) throw new HttpError(401, "unauthorized", "Not authenticated.");
    const input = changeMasterPasswordSchema.parse(req.body);
    await authService.changeMasterPassword(req.userId, input);
    res.status(200).json({ message: "Master password changed. Please sign in again on other devices." });
  }),
);
