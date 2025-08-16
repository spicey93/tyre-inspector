// routes/inspections.js
import { Router } from "express";
import { createInspection, validateInspection, getInspection } from "../controllers/inspection.controller.js";

const router = Router();

router.get("/", getInspection);
router.get("/new", (req, res) => {
  res.render("inspections/new", { data: {} }); // ✅ ensures `data` exists
});
router.post("/", validateInspection, createInspection);

export default router;