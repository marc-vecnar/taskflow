// Authentication middleware. Verifies the Bearer access token and attaches the
// resulting identity to req.user. Used to guard /tasks and /tags endpoints.
import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/errors.js";
import { verifyAccessToken } from "../lib/jwt.js";

export function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const header = req.header("authorization");

  if (!header?.startsWith("Bearer ")) {
    throw AppError.unauthorized("Missing or malformed Authorization header");
  }

  const token = header.slice("Bearer ".length).trim();

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw AppError.unauthorized("Invalid or expired access token");
  }

  // next() is outside the try so a synchronous throw from a downstream
  // handler isn't miscaught and relabeled as an auth failure.
  req.user = { id: payload.sub, email: payload.email };
  next();
}
