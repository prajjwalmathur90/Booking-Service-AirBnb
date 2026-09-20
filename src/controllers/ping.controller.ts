import { Request, Response } from "express";
import logger from "../config/logger.config";
import { sendSuccess } from "../utils/responses/app.response";

export function pingController(req: Request, res: Response) {
  logger.info("Ping controller called", {
    correlationId: req.headers["x-correlation-id"],
  });
  sendSuccess(res, "^_^", 200, "Pong!");
}
