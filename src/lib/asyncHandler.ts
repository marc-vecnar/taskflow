// Wraps an async route handler so a rejected promise is forwarded to Express's
// error middleware. Express 4 catches synchronous throws but NOT async
// rejections; without this, a throwing async handler escapes the { data, error,
// meta } envelope. Use this for every async route handler.
import type { NextFunction, Request, Response } from "express";

type AsyncHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<unknown>;

export function asyncHandler(
  handler: AsyncHandler,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
