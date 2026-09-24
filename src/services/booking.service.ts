import {
  confirmBooking,
  createBooking,
  createIdempotencyKey,
  finailizeIdempotencyKey,
  getIdempotencyKeyWithLock,
} from "../repositories/booking.repository.js";
import { CreateBookingDto } from "../dtos/booking.dto.js";
import { generateIdempotencyKey } from "../utils/idempotency-key/generate-idempotency-key.js";
import {
  conflict,
  internalServerError,
  notFound,
} from "../utils/errors/app.error.js";
import prisma from "../config/prisma.js";
import { redlock } from "../config/redis.config.js";
import { serverConfig } from "../config/index.js";
import { addEmailToQueue } from "../producers/email.producer.js";

export async function createBookingService(bookingData: CreateBookingDto) {
  const ttl = serverConfig.LOCK_TTL;
  const bookingResource = `hotel:${bookingData.hotelId}`;

  try {
    await redlock.acquire([bookingResource], ttl);
  } catch (error) {
    throw internalServerError("Failed to acquire lock for looking resource");
  }

  try {
    const booking = await createBooking(bookingData);
    const idempotencyKey = generateIdempotencyKey();

    await createIdempotencyKey(idempotencyKey, booking.id);
    return { bookingId: booking.id, idempotencyKey: idempotencyKey };
  } catch (error) {
    console.log(error);
    throw internalServerError("Failed to create booking");
  }
}

export async function confirmBookingService(
  idempotencyKey: string,
  email: string,
) {
  return await prisma.$transaction(async (tx) => {
    const idempotencyKeyData = await getIdempotencyKeyWithLock(
      tx,
      idempotencyKey,
    );

    if (!idempotencyKeyData) {
      throw notFound("Idempotency Key not found!");
    }

    if (idempotencyKeyData.finalised) {
      throw conflict("Idempotency Key already finalized!");
    }

    const booking = await confirmBooking(tx, idempotencyKeyData.bookingId);
    await finailizeIdempotencyKey(tx, idempotencyKey);

    addEmailToQueue({
      to: email,
      subject: "Booking confirmed",
      templateId: "BOOKING_CONFIRMED",
      params: { name: "Prajjwal", orderId: booking.id },
    });

    return booking;
  });
}
