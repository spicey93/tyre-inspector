// controllers/technician.controller.js
import User from "../models/user.model.js";
import bcrypt from "bcrypt";

const TECH_LIMITS = {
  free: 1,
  paid: 10,
};

export const createTechnician = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const limit = TECH_LIMITS[req.user.accountStatus] ?? 0;
    const count = await User.countDocuments({ admin: req.user._id, role: "technician" });
    if (limit && count >= limit) {
      return res.status(403).send("Technician limit reached");
    }
    const passwordHash = await bcrypt.hash(password, 10);
    await User.create({ name, email, passwordHash, role: "technician", admin: req.user._id });
    return res.status(201).json({ message: "Technician created" });
  } catch (e) {
    console.error(e);
    return res.status(400).send("Failed to create technician");
  }
};
