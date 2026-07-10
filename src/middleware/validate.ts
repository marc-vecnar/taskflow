// Validation middleware factory. Validates a request segment against a Zod
// schema, replacing it with the parsed/coerced value on success.
import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";
import { AppError } from "../lib/errors.js";

type Segment = "body" | "query" | "params";

export function validate(schema: ZodTypeAny, segment: Segment = "body") {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[segment]);

    if (!result.success) {
      throw AppError.badRequest(
        "Validation failed",
        result.error.flatten(),
      );
    }

    // Overwrite with the coerced/stripped value so handlers get typed data.
    req[segment] = result.data;
    next();
  };
}
