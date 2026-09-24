import { Redis } from "ioredis";
import Redlock, { CompatibleRedisClient } from "redlock";
import { serverConfig } from "./index.js";

export const redisClient = new Redis(serverConfig.REDIS_SERVER_URL);

function connectRedis() {
  try {
    let connection: Redis;

    return () => {
      if (!connection) {
        connection = new Redis(serverConfig.REDIS_SERVER_URL);
        return connection;
      }

      return connection;
    };
  } catch (error) {
    console.error("Error connecting to Redis:", error);
    throw error;
  }
}

export const getRedisConnectionObj = connectRedis();

export const redlock = new Redlock(
  [getRedisConnectionObj() as unknown as CompatibleRedisClient],
  {
    driftFactor: 0.01,
    retryCount: 0,
    retryDelay: 200,
    retryJitter: 100,
  },
);
