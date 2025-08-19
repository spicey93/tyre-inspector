// routes/technician.routes.js
import express from "express";
import { getNewTechnician, createTechnician } from "../controllers/technician.controller.js";
import requireAuth from "../middleware/requireAuth.js";
import requireAdmin from "../middleware/requireAdmin.js";

const router = express.Router();

router.get("/new", requireAuth, requireAdmin, getNewTechnician);
router.post("/", requireAuth, requireAdmin, createTechnician);

export default router;
