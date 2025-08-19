import express from "express";
import {
  listTechnicians,
  getCreateTechnician,
  postCreateTechnician,
  getEditTechnician,
  postEditTechnician,
  postDeleteTechnician,
} from "../controllers/technician.controller.js";
import requireAuth from "../middleware/requireAuth.js";
import requireAdmin from "../middleware/requireAdmin.js";

const router = express.Router();

router.use(requireAuth, requireAdmin);

router.get("/", listTechnicians);
router.get("/new", getCreateTechnician);
router.post("/", postCreateTechnician);
router.get("/:id/edit", getEditTechnician);
router.post("/:id", postEditTechnician);
router.post("/:id/delete", postDeleteTechnician);

export default router;
