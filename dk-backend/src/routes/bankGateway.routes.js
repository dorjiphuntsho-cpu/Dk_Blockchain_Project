import express from "express";
import {
  createMockAccountInquiry,
  createMockAuthToken,
  getMockSignKey,
} from "../controllers/mockBank.controller.js";

const router = express.Router();

router.post("/auth/token", createMockAuthToken);
router.post("/sign/key", getMockSignKey);
router.post("/beneficiary/account_inquiry", createMockAccountInquiry);

export default router;
