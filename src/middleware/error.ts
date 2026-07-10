// Central error handler. Converts thrown errors into the standard
// { data, error, meta } envelope. Mounted last, after all routes.
import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../lib/errors.js";
import { fail } from "../lib/http.js";

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json(
    fail({
      code: "NOT_FOUND",
      message: `Route not found: ${req.method} ${req.path}`,
    }),
  );
}

// Express identifies error handlers by their 4-arg signature; `next` must stay.
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.status).json(
      fail({ code: err.code, message: err.message, details: err.details }),
    );
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json(
      fail({
        code: "BAD_REQUEST",
        message: "Validation failed",
        details: err.flatten(),
      }),
    );
    return;
  }

  // Unknown/unexpected error — don't leak internals to the client.
  console.error("Unhandled error:", err);
  res.status(500).json(
    fail({ code: "INTERNAL_ERROR", message: "Internal server error" }),
  );
}
