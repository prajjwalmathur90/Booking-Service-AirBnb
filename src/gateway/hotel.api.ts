import { serverConfig } from "../config/index.js";
import axios from "axios";

export const getAvailableRooms = async (
  roomCategoryId: number,
  checkInDate: string,
  checkOutDate: string,
) => {
  const response = await axios.get(
    `${serverConfig.HOTEL_SERVICE_URL}/available`,
    {
      params: {
        roomCategoryId,
        checkInDate,
        checkOutDate,
      },
    },
  );

  return response.data.data;
};

export const updateBookingIdToRooms = async (
  bookingId: number,
  roomIds: number[],
) => {
  const response = await axios.put(
    `${serverConfig.HOTEL_SERVICE_URL}/update-booking-id`,
    {
      bookingId,
      roomIds,
    },
  );

  return response.data.data;
};
