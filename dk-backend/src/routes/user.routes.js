import express from "express";
import { createUser, getUserByWallet, getUsers } from "../controllers/user.controller.js";

const router = express.Router();

router.post("/", createUser);
router.get("/", getUsers);
router.get("/wallet/:wallet", getUserByWallet);

export default router;
