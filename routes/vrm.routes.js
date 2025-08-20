// routes/vrm.routes.js
import { Router } from "express";
import { findVrm } from "../controllers/vrm.controller.js";
import requireAuth from "../middleware/requireAuth.js";
import enforceDailyLimit from "../middleware/enforceDailyLimit.js";

const router = Router();

router.post("/", requireAuth, enforceDailyLimit, findVrm);

export default router;
