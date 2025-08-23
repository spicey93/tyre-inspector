// controllers/technician.controller.js
import bcrypt from "bcryptjs";
import User from "../models/user.model.js";

const MAX_TECHNICIANS = 2; // per admin

export const listTechnicians = async (req, res) => {
  const adminId = req.user._id;
  const techs = await User.find({ role: "technician", owner: adminId })
    .sort({ createdAt: -1 })
    .select("name email dailyLimit active createdAt")
    .lean();

  const count = techs.length;
  const remaining = Math.max(0, MAX_TECHNICIANS - count);

  res.render("technicians/index", {
    title: "Technicians — Tyre Inspector",
    technicians: techs,
    remaining,
    max: MAX_TECHNICIANS,
    flash: req.flash?.("tech_msg") || [],
    flashErr: req.flash?.("tech_err") || [],
  });
};

export const createTechnician = async (req, res) => {
  try {
    const adminId = req.user._id;
    const currentCount = await User.countDocuments({ role: "technician", owner: adminId });
    if (currentCount >= MAX_TECHNICIANS) {
      req.flash?.("tech_err", `You can only have up to ${MAX_TECHNICIANS} technicians.`);
      return res.redirect("/technicians");
    }

    const { name = "", email = "", password = "", dailyLimit = "0" } = req.body || {};
    if (!email || !password) {
      req.flash?.("tech_err", "Email and password are required.");
      return res.redirect("/technicians");
    }

    const exists = await User.exists({ email: email.toLowerCase().trim() });
    if (exists) {
      req.flash?.("tech_err", "A user with that email already exists.");
      return res.redirect("/technicians");
    }

    const hash = await bcrypt.hash(password, 10);
    await User.create({
      name: String(name).trim(),
      email: email.toLowerCase().trim(),
      passwordHash: hash,
      role: "technician",
      owner: adminId,
      dailyLimit: Number(dailyLimit) || 0,
      active: true,
    });

    req.flash?.("tech_msg", "Technician created.");
    return res.redirect("/technicians");
  } catch (e) {
    console.error(e);
    req.flash?.("tech_err", "Failed to create technician.");
    return res.redirect("/technicians");
  }
};

export const updateTechnician = async (req, res) => {
  try {
    const adminId = req.user._id;
    const { id } = req.params;
    const tech = await User.findOne({ _id: id, role: "technician", owner: adminId });
    if (!tech) {
      req.flash?.("tech_err", "Technician not found.");
      return res.redirect("/technicians");
    }

    const { name = "", email = "", password = "", dailyLimit = "0", active = "on" } = req.body || {};
    const updates = {
      name: String(name).trim(),
      email: String(email).toLowerCase().trim(),
      dailyLimit: Number(dailyLimit) || 0,
      active: active === "on" || active === "true" || active === true,
    };

    if (password && String(password).trim().length) {
      updates.passwordHash = await bcrypt.hash(password, 10);
    }

    // Prevent email collision
    const other = await User.findOne({ email: updates.email, _id: { $ne: tech._id } }).lean();
    if (other) {
      req.flash?.("tech_err", "Another user already uses that email.");
      return res.redirect("/technicians");
    }

    await User.updateOne({ _id: tech._id }, { $set: updates });
    req.flash?.("tech_msg", "Technician updated.");
    return res.redirect("/technicians");
  } catch (e) {
    console.error(e);
    req.flash?.("tech_err", "Failed to update technician.");
    return res.redirect("/technicians");
  }
};

export const deleteTechnician = async (req, res) => {
  try {
    const adminId = req.user._id;
    const { id } = req.params;
    const tech = await User.findOne({ _id: id, role: "technician", owner: adminId });
    if (!tech) {
      req.flash?.("tech_err", "Technician not found.");
      return res.redirect("/technicians");
    }

    await tech.deleteOne();
    req.flash?.("tech_msg", "Technician deleted.");
    return res.redirect("/technicians");
  } catch (e) {
    console.error(e);
    req.flash?.("tech_err", "Failed to delete technician.");
    return res.redirect("/technicians");
  }
};
