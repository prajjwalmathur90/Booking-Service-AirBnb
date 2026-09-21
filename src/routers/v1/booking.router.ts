import { Router } from "express";
import { validate } from "../../middlewares/validate.js";
import { createBookingSchema } from "../../dtos/booking.dto.js";
import {
  confirmBookingController,
  createBookingController,
} from "../../controllers/booking.controller.js";

const bookingRouter = Router();

bookingRouter.post("/", validate(createBookingSchema), createBookingController);
bookingRouter.post("/confirm/:idempotencyKey", confirmBookingController);

export default bookingRouter;
