import express from "express";
import { serverConfig } from "./config/index.js";
import v1Router from "./routers/v1/index.router.js";
import v2Router from "./routers/v2/index.router.js";
import { genericErrorHandler } from "./middlewares/error.middleware.js";
import logger from "./config/logger.config.js";
import { attachCorrelationIdMiddleware } from "./middlewares/correlation.middleware.js";
import { routeNotFound } from "./middlewares/route-not-found.middleware.js";
import { connectDB } from "./config/prisma.js";
import { addEmailToQueue } from "./producers/email.producer.js";
const app = express();

app.use(express.json());

/**
 * Registering all the routers and their corresponding routes with out app server object.
 */

app.use(attachCorrelationIdMiddleware);
app.use("/api/v1", v1Router);
app.use("/api/v2", v2Router);

/**
 * Add the error handler middleware
 */
app.use(routeNotFound);
app.use(genericErrorHandler);

app.listen(serverConfig.PORT, async () => {
  await connectDB();
  logger.info(`Server is running on http://localhost:${serverConfig.PORT}`);
});
