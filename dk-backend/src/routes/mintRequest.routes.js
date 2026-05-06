import express from "express";
import {
  approveMintRequest,
  createMintRequest,
  getMintRequestById,
  getMintRequests,
  rejectMintRequest,
  updateMintRequestStatus,
} from "../controllers/mintRequest.controller.js";

const router = express.Router();

router.post("/", createMintRequest);
router.get("/", getMintRequests);
router.get("/:id", getMintRequestById);
router.patch("/:id/status", updateMintRequestStatus);
router.patch("/:id/approve", approveMintRequest);
router.patch("/:id/reject", rejectMintRequest);

export default router;
