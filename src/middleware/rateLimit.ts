// Fixed-capacity, sliding-window rate limiter. Dependency-free and in-memory:
// per key (client IP) we keep the timestamps of allowed requests within the
// window and reject once that count reaches `max`. Throws AppError so the
// standard { data, error, meta } envelope renders the 429 — and because it
// throws synchronously, Express 4 forwards it to errorHandler.
//
// In-memory means per-process state (fine for a single instance / tests). A
// multi-instance deployment would need a shared store (e.g. Redis).
import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/errors.js";

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
}

// Every limiter registers its store here so tests can reset all windows between
// cases (see resetRateLimits, wired into the global test beforeEach).
const stores: Array<Map<string, number[]>> = [];

export function resetRateLimits(): void {
  for (const store of stores) store.clear();
}

export function rateLimit({
  windowMs,
  max,
  message = "Too many requests. Please try again later.",
}: RateLimitOptions) {
  const hits = new Map<string, number[]>();
  stores.push(hits);

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip ?? "unknown";
    const now = Date.now();
    const windowStart = now - windowMs;

    // Drop timestamps that have aged out of the window.
    const recent = (hits.get(key) ?? []).filter((t) => t > windowStart);

    if (recent.length >= max) {
      // Tell the client how long until the oldest hit leaves the window.
      const retryAfterMs = recent[0]! + windowMs - now;
      res.setHeader("Retry-After", Math.ceil(retryAfterMs / 1000));
      hits.set(key, recent);
      throw AppError.tooManyRequests(message);
    }

    recent.push(now);
    hits.set(key, recent);
    next();
  };
}
