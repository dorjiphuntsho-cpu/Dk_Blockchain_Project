import express from "express";
import { getTestAccounts, inquireAccount } from "../controllers/cbs.controller.js";

const router = express.Router();

router.get("/test-accounts", getTestAccounts);
router.post("/account-inquiry", inquireAccount);

export default router;
