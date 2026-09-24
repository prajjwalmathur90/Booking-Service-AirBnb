import { Router } from "express";
import { validateRequest, validateQuery } from "../../middlewares/validate.js";
import {
  createBookingSchema,
  confirmBookingQuerySchema,
} from "../../dtos/booking.dto.js";
import {
  confirmBookingController,
  createBookingController,
} from "../../controllers/booking.controller.js";

const bookingRouter = Router();

bookingRouter.post(
  "/",
  validateRequest(createBookingSchema),
  createBookingController,
);
bookingRouter.post(
  "/confirm/:idempotencyKey",
  validateQuery(confirmBookingQuerySchema),
  confirmBookingController,
);

export default bookingRouter;
