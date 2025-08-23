// controllers/technician.controller.js
import bcrypt from "bcryptjs";
import User from "../models/user.model.js";

const MAX_TECHNICIANS = 2; // per admin

/**
 * Compute how many daily usages from the admin's pool are still available
 * to assign to technicians.
 *
 * If the admin has an unlimited pool (dailyLimit <= 0), we return Infinity
 * to indicate "no cap".
 *
 * You can optionally exclude a technician id (useful when updating that tech).
 */
async function getRemainingPoolForAdmin(adminId, { excludeTechId = null } = {}) {
  const admin = await User.findById(adminId).select("dailyLimit").lean();
  const adminPool = Number(admin?.dailyLimit || 0);

  // Unlimited pool => no cap at assignment time
  if (adminPool <= 0) return Number.POSITIVE_INFINITY;

  const match = { role: "technician", owner: adminId };
  if (excludeTechId) match._id = { $ne: excludeTechId };

  const agg = await User.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: { $ifNull: ["$dailyLimit", 0] } } } },
  ]);

  const assignedToOtherTechs = Number(agg?.[0]?.total || 0);
  const remaining = Math.max(0, adminPool - assignedToOtherTechs);
  return remaining;
}

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

    // ---- Enforce pool-based cap on technician dailyLimit ----
    const rawRequested = Number(dailyLimit) || 0;
    const remainingPool = await getRemainingPoolForAdmin(adminId);
    // If remainingPool is Infinity (admin unlimited), allow any non-negative number
    let cappedDailyLimit =
      remainingPool === Number.POSITIVE_INFINITY
        ? Math.max(0, rawRequested)
        : Math.min(Math.max(0, rawRequested), remainingPool);

    const hash = await bcrypt.hash(password, 10);
    await User.create({
      name: String(name).trim(),
      email: email.toLowerCase().trim(),
      passwordHash: hash,
      role: "technician",
      owner: adminId,
      dailyLimit: cappedDailyLimit,
      active: true,
    });

    if (cappedDailyLimit < rawRequested) {
      req.flash?.(
        "tech_msg",
        `Technician created. Daily limit capped to ${cappedDailyLimit} based on account pool.`
      );
    } else {
      req.flash?.("tech_msg", "Technician created.");
    }
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
    const requested = Number(dailyLimit) || 0;

    // Prevent email collision
    const emailNormalized = String(email).toLowerCase().trim();
    const other = await User.findOne({ email: emailNormalized, _id: { $ne: tech._id } }).lean();
    if (other) {
      req.flash?.("tech_err", "Another user already uses that email.");
      return res.redirect("/technicians");
    }

    // ---- Enforce pool-based cap on technician dailyLimit (exclude this tech from the sum) ----
    const remainingPoolExcludingThisTech = await getRemainingPoolForAdmin(adminId, { excludeTechId: tech._id });
    // If admin pool unlimited, no cap; otherwise the max this tech can have is the remaining capacity.
    const cappedDailyLimit =
      remainingPoolExcludingThisTech === Number.POSITIVE_INFINITY
        ? Math.max(0, requested)
        : Math.min(Math.max(0, requested), remainingPoolExcludingThisTech);

    const updates = {
      name: String(name).trim(),
      email: emailNormalized,
      dailyLimit: cappedDailyLimit,
      active: active === "on" || active === "true" || active === true,
    };

    if (password && String(password).trim().length) {
      updates.passwordHash = await bcrypt.hash(password, 10);
    }

    await User.updateOne({ _id: tech._id }, { $set: updates });

    if (cappedDailyLimit < requested) {
      req.flash?.(
        "tech_msg",
        `Technician updated. Daily limit capped to ${cappedDailyLimit} based on account pool.`
      );
    } else {
      req.flash?.("tech_msg", "Technician updated.");
    }
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
