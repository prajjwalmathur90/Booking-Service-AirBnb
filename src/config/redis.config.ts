import { Redis } from "ioredis";
import Redlock, { CompatibleRedisClient } from "redlock";
import { serverConfig } from "./index.js";

export const redisClient = new Redis(serverConfig.REDIS_SERVER_URL);

export const redlock = new Redlock([redisClient as unknown as CompatibleRedisClient], {
  driftFactor: 0.01,
  retryCount: 0,
  retryDelay: 200,
  retryJitter: 100,
});
