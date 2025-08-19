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
    // return HTML redirect for browser forms or JSON for API requests
    if (req.headers.accept && req.headers.accept.includes("application/json")) {
      return res.status(201).json({ message: "Technician created" });
    }
    return res.redirect("/technicians");
  } catch (e) {
    console.error(e);
    return res.status(400).send("Failed to create technician");
  }
};

export const listTechnicians = async (req, res) => {
  const techs = await User.find({ admin: req.user._id, role: "technician" }).lean();
  res.render("technicians", { title: "Technicians", techs });
};

export const updateTechnician = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password } = req.body;
    const tech = await User.findOne({ _id: id, admin: req.user._id, role: "technician" });
    if (!tech) {
      return res.status(404).send("Not found");
    }
    tech.name = name;
    tech.email = email;
    if (password) {
      tech.passwordHash = await bcrypt.hash(password, 10);
    }
    await tech.save();
    if (req.headers.accept && req.headers.accept.includes("application/json")) {
      return res.json({ message: "Technician updated" });
    }
    return res.redirect("/technicians");
  } catch (e) {
    console.error(e);
    return res.status(400).send("Failed to update technician");
  }
};

export const deleteTechnician = async (req, res) => {
  try {
    const { id } = req.params;
    await User.deleteOne({ _id: id, admin: req.user._id, role: "technician" });
    if (req.headers.accept && req.headers.accept.includes("application/json")) {
      return res.json({ message: "Technician deleted" });
    }
    return res.redirect("/technicians");
  } catch (e) {
    console.error(e);
    return res.status(400).send("Failed to delete technician");
  }
};
