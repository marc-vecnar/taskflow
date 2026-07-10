// Authentication business logic: registration, login, and refresh-token
// rotation. This layer owns all Prisma access and stays free of Express types
// so it can be unit-tested directly.
import { Prisma } from "@prisma/client";
import { AppError } from "../lib/errors.js";
import {
  hashToken,
  signAccessToken,
  signRefreshToken,
  tokenExpiry,
  verifyRefreshToken,
} from "../lib/jwt.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { prisma } from "../lib/prisma.js";

interface Identity {
  id: string;
  email: string;
}

export interface AuthResult {
  user: Identity;
  accessToken: string;
  refreshToken: string;
}

// Signs a fresh token pair for a user and persists the refresh token (hashed)
// so it can later be rotated or revoked.
async function issueTokens(user: Identity): Promise<AuthResult> {
  // Build a clean identity so callers passing a full Prisma User don't leak
  // passwordHash (or any other column) into the response.
  const identity: Identity = { id: user.id, email: user.email };

  const accessToken = signAccessToken({ sub: identity.id, email: identity.email });
  const refreshToken = signRefreshToken({ sub: identity.id });

  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(refreshToken),
      userId: identity.id,
      expiresAt: tokenExpiry(refreshToken),
    },
  });

  return { user: identity, accessToken, refreshToken };
}

export async function register(
  email: string,
  password: string,
): Promise<AuthResult> {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw AppError.conflict("Email already registered");
  }

  const passwordHash = await hashPassword(password);

  try {
    const user = await prisma.user.create({ data: { email, passwordHash } });
    return await issueTokens(user);
  } catch (err) {
    // Guards against a race between the check above and the insert.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw AppError.conflict("Email already registered");
    }
    throw err;
  }
}

export async function login(
  email: string,
  password: string,
): Promise<AuthResult> {
  const user = await prisma.user.findUnique({ where: { email } });

  // Use one identical message for unknown-email and wrong-password so we don't
  // leak which emails are registered.
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw AppError.unauthorized("Invalid email or password");
  }

  return issueTokens(user);
}

export async function refresh(token: string): Promise<AuthResult> {
  let payload: { sub: string };
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw AppError.unauthorized("Invalid or expired refresh token");
  }

  // The signature is valid, but the token must still be the live, unrevoked
  // row we persisted — verification checks DB state, not just the JWT.
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!stored || stored.revokedAt || stored.expiresAt <= new Date()) {
    throw AppError.unauthorized("Invalid or expired refresh token");
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) {
    throw AppError.unauthorized("Invalid or expired refresh token");
  }

  // Rotate: revoke the presented token, then issue a new pair.
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  return issueTokens(user);
}
