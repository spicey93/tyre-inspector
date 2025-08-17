// routes/inspection.routes.js
import express from "express";
import {newInspection} from "../controllers/inspection.controller.js"

const router = express.Router();

router.get("/new", newInspection);

export default router;
