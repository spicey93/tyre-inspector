// routes/inspection.routes.js
import express from "express";
import {
  showByCode,
  newInspection,
  listBrands,
  listModelsByBrand,
  createInspection,
  deleteInspection,       // ⬅️ NEW
} from "../controllers/inspection.controller.js";
import requireAuth from "../middleware/requireAuth.js";
import enforceDailyLimit from "../middleware/enforceDailyLimit.js";

const router = express.Router();

// Public "show by code" (used by shareable link)
router.get("/", showByCode);

// Create flow
router.get("/new", requireAuth, enforceDailyLimit, newInspection);
router.get("/api/tyres/brands", listBrands);
router.get("/api/tyres/models", listModelsByBrand);
router.post("/", requireAuth, enforceDailyLimit, createInspection);

// Delete an inspection by Mongo _id (must belong to the logged-in user)
router.delete("/:id", requireAuth, deleteInspection); // ⬅️ NEW

export default router;
