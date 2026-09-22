import prisma from "../config/prisma.js";
import logger from "../config/logger.config.js";
import { CreateBookingDto } from "../dtos/booking.dto.js";
import { IdempotencyKey, Prisma } from "../../generated/prisma/client.js";
import { validate as isValidUUID } from "uuid";
import { badRequest, notFound } from "../utils/errors/app.error.js";

export async function createBooking(bookingData: CreateBookingDto) {
  const booking = await prisma.booking.create({
    data: bookingData,
  });

  logger.info(
    `Booking Created for user ${bookingData.userId}`,
    `Booking ID : ${booking.id}`,
  );

  return booking;
}

export async function createIdempotencyKey(key: string, bookingId: number) {
  const idempotencyKey = await prisma.idempotencyKey.create({
    data: {
      idemKey: key,
      booking: {
        connect: {
          id: bookingId,
        },
      },
    },
  });

  logger.info(
    `Idempotency key created for booking ${bookingId}`,
    `Idempotency key : ${key}`,
  );

  return idempotencyKey;
}

export async function getIdempotencyKeyWithLock(
  tx: Prisma.TransactionClient,
  key: string,
) {
  if (!isValidUUID(key)) {
    throw badRequest("Idempotency Key is not valid!");
  }

  const idempotencyKey: Array<IdempotencyKey> =
    await tx.$queryRaw`SELECT * FROM IdempotencyKey WHERE IdemKey = ${key} FOR UPDATE`;

  if (!idempotencyKey || idempotencyKey.length == 0) {
    throw notFound("Idempotency Key not found!");
  }

  return idempotencyKey[0];
}

export async function getBookingById(bookingId: number) {
  const booking = await prisma.booking.findUnique({
    where: {
      id: bookingId,
    },
  });

  return booking;
}

export async function confirmBooking(
  tx: Prisma.TransactionClient,
  bookingId: number,
) {
  const booking = await tx.booking.update({
    where: {
      id: bookingId,
    },
    data: {
      bookingStatus: "CONFIRMED",
    },
  });

  logger.info(`Booking confirmed for booking ${bookingId}`);

  return booking;
}

export async function cancelBooking(bookingId: number) {
  const booking = await prisma.booking.update({
    where: {
      id: bookingId,
    },
    data: {
      bookingStatus: "CANCELLED",
    },
  });

  logger.info(`Booking cancelled for booking ${bookingId}`);

  return booking;
}

export async function finailizeIdempotencyKey(
  tx: Prisma.TransactionClient,
  key: string,
) {
  const idempotencyKey = await tx.idempotencyKey.update({
    where: {
      idemKey: key,
    },
    data: {
      finalised: true,
    },
  });

  logger.info(`Idempotency key finalized for key ${key}`);

  return idempotencyKey;
}
