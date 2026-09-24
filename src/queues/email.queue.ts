import { Queue } from "bullmq";
import { getRedisConnectionObj } from "../config/redis.config.js";

export const MAILER_QUEUE = "queue-mailer";

export const mailerQueue = new Queue(MAILER_QUEUE, {
  connection: getRedisConnectionObj(),
});
