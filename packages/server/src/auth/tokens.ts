import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { config } from "../config.js";

export interface AccessTokenPayload {
  sub: string; // user id
  email: string;
  type: "access";
}

export interface RefreshTokenPayload {
  sub: string;
  type: "refresh";
  /** Unique per-issuance ID, lets us track/revoke individual refresh tokens server-side */
  jti: string;
}

export function signAccessToken(userId: string, email: string): string {
  const payload: AccessTokenPayload = { sub: userId, email, type: "access" };
  return jwt.sign(payload, config.jwtAccessSecret, {
    expiresIn: config.jwtAccessTtl,
    issuer: "axisvault",
    audience: "axisvault-client",
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, config.jwtAccessSecret, {
    issuer: "axisvault",
    audience: "axisvault-client",
  });
  if (typeof decoded === "string" || decoded.type !== "access") {
    throw new Error("Invalid access token payload");
  }
  return decoded as AccessTokenPayload;
}

export function signRefreshToken(userId: string): { token: string; jti: string } {
  const jti = crypto.randomUUID();
  const payload: RefreshTokenPayload = { sub: userId, type: "refresh", jti };
  const token = jwt.sign(payload, config.jwtRefreshSecret, {
    expiresIn: `${config.jwtRefreshTtlDays}d`,
    issuer: "axisvault",
    audience: "axisvault-client",
  } as jwt.SignOptions);
  return { token, jti };
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const decoded = jwt.verify(token, config.jwtRefreshSecret, {
    issuer: "axisvault",
    audience: "axisvault-client",
  });
  if (typeof decoded === "string" || decoded.type !== "refresh") {
    throw new Error("Invalid refresh token payload");
  }
  return decoded as RefreshTokenPayload;
}

/** We never store raw refresh tokens — only a SHA-256 hash — so a DB leak can't be replayed directly. */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
