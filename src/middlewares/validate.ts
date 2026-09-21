import { NextFunction, Request, Response } from "express";
import { ZodSchema } from "zod";
import { badRequest } from "../utils/errors/app.error.js";

export const validate =
  (schema: ZodSchema) => (req: Request, _res: Response, next: NextFunction) => {
    if (req.body === undefined) {
      throw badRequest(
        "Request body is required. Send JSON with Content-Type: application/json",
      );
    }

    const result = schema.safeParse(req.body);

    if (!result.success) {
      throw badRequest("Validation Failed", result.error.issues);
    }

    req.body = result.data;

    next();
  };
