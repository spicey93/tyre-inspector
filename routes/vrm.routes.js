import { Router } from "express";
import { findVrm } from "../controllers/vrm.controller.js";

const router = Router();

router.post("/", findVrm);

export default router;
