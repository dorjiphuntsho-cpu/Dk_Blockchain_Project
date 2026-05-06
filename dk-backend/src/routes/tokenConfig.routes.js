import express from "express";
import { getTokenConfig, updateTokenConfig } from "../controllers/tokenConfig.controller.js";

const router = express.Router();

router.get("/", getTokenConfig);
router.put("/", updateTokenConfig);

export default router;
