export class AppError extends Error {
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.name = "AppError";
    Error.captureStackTrace(this, this.constructor);
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, message, details);

export const unauthorized = (message: string, details?: unknown) =>
  new AppError(401, message, details);

export const forbidden = (message: string, details?: unknown) =>
  new AppError(403, message, details);

export const notFound = (message: string, details?: unknown) =>
  new AppError(404, message, details);

export const conflict = (message: string, details?: unknown) =>
  new AppError(409, message, details);

export const internalServerError = (message = "Internal Server Error") =>
  new AppError(500, message);
