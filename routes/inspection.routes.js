// routes/inspection.routes.js
import express from "express";
import { showByCode, newInspection, listBrands, listModelsByBrand, createInspection } from "../controllers/inspection.controller.js";

const router = express.Router();

router.get("/", showByCode);    
router.get("/new", newInspection);
router.get("/api/tyres/brands", listBrands);
router.get("/api/tyres/models", listModelsByBrand);
router.post("/", createInspection); 

export default router;
