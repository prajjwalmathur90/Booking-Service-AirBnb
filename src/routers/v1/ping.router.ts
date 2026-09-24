import express from "express";
import { pingController } from "../../controllers/ping.controller.js";
import { validateRequest } from "../../middlewares/validate.js";
import { pingValidateSchema } from "../../dtos/ping.dto.js";
const pingRouter = express.Router();

pingRouter.get("/", validateRequest(pingValidateSchema), pingController);

export default pingRouter;
