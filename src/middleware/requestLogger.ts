// Request logging middleware. Emits one structured line per request on
// completion with the HTTP method, path, status code, and response time. Timing
// starts when the middleware runs and is read on the response's `finish` event,
// so it covers the full handler chain.
import type { NextFunction, Request, Response } from "express";
import { logger } from "../lib/logger.js";

export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const responseTimeMs =
      Number(process.hrtime.bigint() - start) / 1_000_000;

    logger.info(
      {
        method: req.method,
        // originalUrl is stable even after sub-routers rewrite req.url.
        path: req.originalUrl,
        statusCode: res.statusCode,
        responseTimeMs: Math.round(responseTimeMs * 1000) / 1000,
      },
      "request completed",
    );
  });

  next();
}
