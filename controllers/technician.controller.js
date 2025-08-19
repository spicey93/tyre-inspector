// controllers/technician.controller.js
import User from "../models/user.model.js";
import bcrypt from "bcrypt";

export const getNewTechnician = (req, res) => {
  res.render("technicians/new");
};

export const createTechnician = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const existing = await User.countDocuments({ admin: req.user._id });
    const limit = req.user.plan === "paid" ? 5 : 1;
    if (existing >= limit) {
      return res.status(403).render("technicians/new", { error: `Technician limit reached (${limit})` });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    await User.create({ name, email, passwordHash, role: "technician", admin: req.user._id });
    res.redirect("/dashboard");
  } catch (e) {
    res.status(400).render("technicians/new", { error: "Could not create technician" });
  }
};
