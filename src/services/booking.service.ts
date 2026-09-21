import { Prisma } from "../../generated/prisma/client.js";
import {
  confirmBooking,
  createBooking,
  createIdempotencyKey,
  finailizeIdempotencyKey,
  getIdempotencyKey,
} from "../repositories/booking.repository.js";
import { CreateBookingDto } from "../dtos/booking.dto.js";
import { generateIdempotencyKey } from "../utils/idempotency-key/generate-idempotency-key.js";
import { badRequest, notFound } from "../utils/errors/app.error.js";

export async function createBookingService(bookingData: CreateBookingDto) {
  const booking = await createBooking(bookingData);
  const idempotencyKey = generateIdempotencyKey();

  await createIdempotencyKey(idempotencyKey, booking.id);
  return { bookingId: booking.id, idempotencyKey: idempotencyKey };
}

export async function confirmBookingService(idempotencyKey: string) {
  const idempotencyKeyData = await getIdempotencyKey(idempotencyKey);

  if (!idempotencyKeyData) {
    throw notFound("Idempotency Key not found!");
  }

  if (idempotencyKeyData.finalised) {
    throw badRequest("Idempotency Key already finalized!");
  }

  const booking = await confirmBooking(idempotencyKeyData.bookingId);
  await finailizeIdempotencyKey(idempotencyKeyData.idemKey);

  return booking;
}
