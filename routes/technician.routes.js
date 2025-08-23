// routes/technician.routes.js
import express from "express";
import requireAuth from "../middleware/requireAuth.js";
import requireAdmin from "../middleware/requireAdmin.js";
import {
  listTechnicians,
  createTechnician,
  updateTechnician,
  deleteTechnician,
} from "../controllers/technician.controller.js";

const router = express.Router();

router.get("/", requireAuth, requireAdmin, listTechnicians);
router.post("/", requireAuth, requireAdmin, createTechnician);
router.post("/:id/update", requireAuth, requireAdmin, updateTechnician);
router.post("/:id/delete", requireAuth, requireAdmin, deleteTechnician);

export default router;
