import express, { Request, Response } from "express";
import { pingController } from "../../controllers/ping.controller";
import { validate } from "../../middlewares/validate";
import { pingValidateSchema } from "../../dtos/ping.dto";
const pingRouter = express.Router();

pingRouter.get("/", validate(pingValidateSchema), pingController);

export default pingRouter;
