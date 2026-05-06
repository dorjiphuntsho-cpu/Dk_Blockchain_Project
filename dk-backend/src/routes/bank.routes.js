import express from "express";
import { createBank, getBankByWallet, getBanks, updateBankReserve } from "../controllers/bank.controller.js";

const router = express.Router();

router.post("/", createBank);
router.get("/", getBanks);
router.get("/wallet/:wallet", getBankByWallet);
router.patch("/:id/reserve", updateBankReserve);

export default router;
