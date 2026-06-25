import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { logger } from "../logger.js";

export class HttpError extends Error {
  statusCode: number;
  errorCode: string;

  constructor(statusCode: number, errorCode: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

/** Wraps an async route handler so rejected promises reach Express's error middleware instead of crashing the process. */
export function asyncHandler(fn: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof HttpError) {
    res.status(err.statusCode).json({ error: err.errorCode, message: err.message, statusCode: err.statusCode });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: "validation_error",
      message: "Request failed validation.",
      statusCode: 400,
      details: err.flatten().fieldErrors,
    });
    return;
  }

  // Anything else is unexpected — log full detail server-side (with redaction
  // already applied by the logger config) but never leak internals to the client.
  logger.error({ err, path: req.path, method: req.method }, "Unhandled error");
  res.status(500).json({
    error: "internal_error",
    message: "Something went wrong on our end. Please try again.",
    statusCode: 500,
  });
}
