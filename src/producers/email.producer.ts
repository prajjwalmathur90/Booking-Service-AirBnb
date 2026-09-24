import { NotificationDto } from "../dtos/notification.dto.js";
import { mailerQueue } from "../queues/email.queue.js";

export const MAILER_PAYLOAD = "payload-mailer";

export const addEmailToQueue = async (payload: NotificationDto) => {
  await mailerQueue.add(MAILER_PAYLOAD, payload);
  console.log(`Email added to queue with payload: ${JSON.stringify(payload)}`);
};
