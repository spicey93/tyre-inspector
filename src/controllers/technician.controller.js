// controllers/technician.controller.js
import bcrypt from "bcrypt";
import User from "../models/user.model.js";

export const listTechnicians = async (req, res) => {
  const technicians = await User.find({ admin: req.user._id }).lean();
  res.render("technicians/list", { technicians });
};

export const getCreateTechnician = (_req, res) => {
  res.render("technicians/new");
};

export const postCreateTechnician = async (req, res) => {
  try {
    const { name, email, password, dailyLimit } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);
    await User.create({
      name,
      email,
      passwordHash,
      dailyLimit: Number(dailyLimit) || 0,
      role: "technician",
      admin: req.user._id,
    });
    res.redirect("/technicians");
  } catch (e) {
    res.status(400).render("technicians/new", { error: "Failed to create technician" });
  }
};

export const getEditTechnician = async (req, res) => {
  const tech = await User.findOne({ _id: req.params.id, admin: req.user._id }).lean();
  if (!tech) return res.status(404).send("Not found");
  res.render("technicians/edit", { technician: tech });
};

export const postEditTechnician = async (req, res) => {
  const tech = await User.findOne({ _id: req.params.id, admin: req.user._id });
  if (!tech) return res.status(404).send("Not found");

  const { name, email, password, dailyLimit } = req.body;
  tech.name = name;
  tech.email = email;
  tech.dailyLimit = Number(dailyLimit) || 0;
  if (password) {
    tech.passwordHash = await bcrypt.hash(password, 10);
  }
  await tech.save();
  res.redirect("/technicians");
};

export const postDeleteTechnician = async (req, res) => {
  await User.deleteOne({ _id: req.params.id, admin: req.user._id });
  res.redirect("/technicians");
};
