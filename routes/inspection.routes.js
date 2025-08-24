// routes/inspection.routes.js
import express from "express";
import {
  showByCode,
  newInspection,
  listBrands,
  listModelsByBrand,
  createInspection,
  deleteInspection,
  indexInspections,
  editInspection,      // NEW
  updateInspection,    // NEW
} from "../controllers/inspection.controller.js";
import requireAuth from "../middleware/requireAuth.js";
import enforceDailyLimit from "../middleware/enforceDailyLimit.js";
import requireAdmin from "../middleware/requireAdmin.js";

const router = express.Router();

router.get("/", (req, res, next) => {
  if (req.query?.code) return showByCode(req, res, next);
  return requireAuth(req, res, () => indexInspections(req, res, next));
});

// Create flow (admins and technicians can create; limit enforced by middleware)
router.get("/new", requireAuth, enforceDailyLimit, newInspection);
router.get("/api/tyres/brands", listBrands);
router.get("/api/tyres/models", listModelsByBrand);
router.post("/", requireAuth, enforceDailyLimit, createInspection);

// ----- EDIT (ADMIN ONLY) -----
router.get("/:id/edit", requireAuth, requireAdmin, editInspection);
router.post("/:id/update", requireAuth, requireAdmin, updateInspection);

// Delete an inspection by Mongo _id — ADMIN ONLY
router.delete("/:id", requireAuth, requireAdmin, deleteInspection);

export default router;
