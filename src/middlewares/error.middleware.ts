import { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/errors/app.error.js";

export function genericErrorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  const body: Record<string, unknown> = {
    success: false,
    message: err.message,
  };

  if (err.details) {
    body.details = err.details;
  }

  // if (process.env.NODE_ENV === "development") {
  //   body.stack = err.stack;
  // }

  res.status(err.statusCode || 500).json(body);
}
