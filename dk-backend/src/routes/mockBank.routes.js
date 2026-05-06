import express from "express";
import { createMockPayout } from "../controllers/mockBank.controller.js";
import bankGatewayRoutes from "./bankGateway.routes.js";

const router = express.Router();

router.post("/payout", createMockPayout);
router.use("/v1", bankGatewayRoutes);

export default router;
