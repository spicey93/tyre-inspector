// controllers/technician.controller.js
import User from "../models/user.model.js";
import bcrypt from "bcrypt";

const TECH_LIMITS = {
  free: 1,
  paid: 10,
};

export const listTechnicians = async (req, res) => {
  const technicians = await User.find({ admin: req.user._id, role: "technician" }).lean();
  const limit = TECH_LIMITS[req.user.accountStatus] ?? 0;
  res.render("technicians/index", { technicians, limit, count: technicians.length });
};

export const createTechnician = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const limit = TECH_LIMITS[req.user.accountStatus] ?? 0;
    const count = await User.countDocuments({ admin: req.user._id, role: "technician" });
    if (limit && count >= limit) {
      return res.redirect("/technicians");
    }
    const passwordHash = await bcrypt.hash(password, 10);
    await User.create({ name, email, passwordHash, role: "technician", admin: req.user._id });
    return res.redirect("/technicians");
  } catch (e) {
    console.error(e);
    return res.status(400).send("Failed to create technician");
  }
};

export const updateTechnician = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const tech = await User.findOne({ _id: req.params.id, admin: req.user._id, role: "technician" });
    if (!tech) {
      return res.status(404).send("Technician not found");
    }
    if (name) tech.name = name;
    if (email) tech.email = email;
    if (password) tech.passwordHash = await bcrypt.hash(password, 10);
    await tech.save();
    return res.redirect("/technicians");
  } catch (e) {
    console.error(e);
    return res.status(400).send("Failed to update technician");
  }
};

export const deleteTechnician = async (req, res) => {
  try {
    await User.deleteOne({ _id: req.params.id, admin: req.user._id, role: "technician" });
    return res.redirect("/technicians");
  } catch (e) {
    console.error(e);
    return res.status(400).send("Failed to delete technician");
  }
};
