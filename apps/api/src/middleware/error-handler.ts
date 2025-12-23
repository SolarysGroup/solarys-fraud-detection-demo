import { type Request, type Response, type NextFunction } from "express";

export interface ApiError extends Error {
  statusCode?: number;
}

export function errorHandler(
  err: ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  const statusCode = err.statusCode ?? 500;
  const message = err.message ?? "Internal Server Error";

  console.error(`[ERROR] ${statusCode}: ${message}`, err.stack);

  res.status(statusCode).json({
    error: {
      message,
      statusCode,
    },
  });
}
