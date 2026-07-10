// JWT signing/verification for access and refresh tokens.
import crypto from "node:crypto";
import jwt, { type SignOptions } from "jsonwebtoken";
import { config } from "./config.js";
import type { AccessTokenPayload, RefreshTokenPayload } from "./types.js";

// expiresIn comes from config as a string (e.g. "15m"); cast to the library's
// branded StringValue type which a plain string won't satisfy structurally.
const accessOpts: SignOptions = {
  expiresIn: config.JWT_ACCESS_EXPIRES_IN as SignOptions["expiresIn"],
};
const refreshOpts: SignOptions = {
  expiresIn: config.JWT_REFRESH_EXPIRES_IN as SignOptions["expiresIn"],
};

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, config.JWT_ACCESS_SECRET, accessOpts);
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, config.JWT_REFRESH_SECRET, refreshOpts);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, config.JWT_ACCESS_SECRET) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, config.JWT_REFRESH_SECRET) as RefreshTokenPayload;
}

// Refresh tokens are stored hashed (never in plaintext) for revocation lookups.
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Derives a token's expiry from its own `exp` claim, so a persisted
// RefreshToken row's expiresAt stays in sync with the signed JWT.
export function tokenExpiry(token: string): Date {
  const decoded = jwt.decode(token);
  if (decoded && typeof decoded === "object" && typeof decoded.exp === "number") {
    return new Date(decoded.exp * 1000);
  }
  throw new Error("Token is missing an exp claim");
}
