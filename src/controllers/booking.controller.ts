import { Request, Response } from "express";
import {
  confirmBookingService,
  createBookingService,
} from "../services/booking.service.js";
import { sendSuccess } from "../utils/responses/app.response.js";

export async function createBookingController(req: Request, res: Response) {
  const booking = await createBookingService(req.body);
  sendSuccess(res, booking, 201, "Booking created successfully");
}

export async function confirmBookingController(req: Request, res: Response) {
  const { idempotencyKey } = req.params;
  const { email } = req.query as { email: string };

  const booking = await confirmBookingService(idempotencyKey!, email);
  sendSuccess(res, booking, 200, "Booking confirmed!");
}
