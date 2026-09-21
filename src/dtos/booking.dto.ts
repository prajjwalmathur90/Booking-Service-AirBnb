import { z } from "zod";

export const createBookingSchema = z.object({
  userId: z.number({ message: "User ID must be present" }),
  hotelId: z.number({ message: "Hotel ID must be present" }),
  totalGuest: z
    .number({ message: "Total guests must be present" })
    .min(1, { message: "Total guests must be at least 1" }),
  bookingAmount: z
    .number({ message: "Booking amount must be present" })
    .min(1, { message: "Booking amount must be greater than 1" }),
});

export type CreateBookingDto = z.infer<typeof createBookingSchema>;
