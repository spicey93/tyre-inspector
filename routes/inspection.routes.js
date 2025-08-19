// routes/inspection.routes.js
import express from "express";
import { showByCode, newInspection, listBrands, listModelsByBrand, createInspection } from "../controllers/inspection.controller.js";
import requireAuth from "../middleware/requireAuth.js";
import enforceDailyLimit from "../middleware/enforceDailyLimit.js";


const router = express.Router();

router.get("/", showByCode);    
router.get("/new", requireAuth, enforceDailyLimit,  newInspection);
router.get("/api/tyres/brands", listBrands);
router.get("/api/tyres/models", listModelsByBrand);
router.post("/", requireAuth, enforceDailyLimit, createInspection); 

export default router;
