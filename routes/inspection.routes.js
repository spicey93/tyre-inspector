// routes/inspection.routes.js
import express from "express";
import {
  showByCode,
  newInspection,
  listBrands,
  listModelsByBrand,
  createInspection,
  deleteInspection,
  indexInspections
} from "../controllers/inspection.controller.js";
import requireAuth from "../middleware/requireAuth.js";
import enforceDailyLimit from "../middleware/enforceDailyLimit.js";

const router = express.Router();

/**
 * GET /inspections
 * - If ?code=XXXXXX is present -> public "show by code"
 * - Otherwise -> authenticated Inspections Index
 */
router.get("/", (req, res, next) => {
  if (req.query?.code) return showByCode(req, res, next);
  return requireAuth(req, res, () => indexInspections(req, res, next));
});

// Create flow
router.get("/new", requireAuth, enforceDailyLimit, newInspection);
router.get("/api/tyres/brands", listBrands);
router.get("/api/tyres/models", listModelsByBrand);
router.post("/", requireAuth, enforceDailyLimit, createInspection);

// Delete an inspection by Mongo _id (must belong to the account)
router.delete("/:id", requireAuth, deleteInspection);

export default router;
