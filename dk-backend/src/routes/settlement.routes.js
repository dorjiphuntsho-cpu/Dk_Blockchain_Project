import express from "express";
import {
  createSettlement,
  createUnregisteredFiatSettlement,
  getSettlements,
  refreshSettlementStatus,
} from "../controllers/settlement.controller.js";

const router = express.Router();

router.post("/", createSettlement);
router.get("/", getSettlements);
router.post("/fiat/unregistered", createUnregisteredFiatSettlement);
router.post("/:id/status", refreshSettlementStatus);

export default router;
