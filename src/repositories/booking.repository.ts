import { Prisma } from "../../generated/prisma/client.js";
import prisma from "../config/prisma.js";
import logger from "../config/logger.config.js";

export async function createBooking(bookingInput: Prisma.BookingCreateInput) {
  const booking = await prisma.booking.create({
    data: bookingInput,
  });

  logger.info(
    `Booking Created for user ${bookingInput.userId}`,
    `Booking ID : ${booking.id}`,
  );

  return booking;
}
