// controllers/dashboard.controller.js
import Inspection from "../models/inspection.model.js";
import UsageEvent from "../models/usageEvent.model.js";

function startOfDay(d = new Date()) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function startOfMonth(d = new Date()) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function startOfWeek(d = new Date()) {
  // Week starts Monday
  const day = d.getDay() || 7; // Sun=0 -> 7
  const monday = new Date(d);
  monday.setDate(d.getDate() - (day - 1));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export const dashboard = async (req, res) => {
  // For technicians, show stats for their admin account
  const isAdmin = req.user?.role === "admin";
  const accountId = isAdmin ? req.user._id : (req.user.owner || req.user._id);

  const today = startOfDay();
  const weekStart = startOfWeek();
  const monthStart = startOfMonth();

  const [total, todayCount, weekCount, monthCount, distinctVrms, latest, recent] = await Promise.all([
    Inspection.countDocuments({ user: accountId }),
    Inspection.countDocuments({ user: accountId, createdAt: { $gte: today } }),
    Inspection.countDocuments({ user: accountId, createdAt: { $gte: weekStart } }),
    Inspection.countDocuments({ user: accountId, createdAt: { $gte: monthStart } }),
    Inspection.distinct("vrm", { user: accountId }),
    Inspection.findOne({ user: accountId }).sort({ createdAt: -1 }).lean(),
    Inspection.find({ user: accountId }).sort({ createdAt: -1 }).limit(5).lean(),
  ]);

  // Daily VRM usage for the *account* (pool). Include fallback for legacy events without billedTo
  const now = new Date();
  const startUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
  const endUTC   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
  const usedToday = await UsageEvent.countDocuments({
    createdAt: { $gte: startUTC, $lt: endUTC },
    $or: [
      { billedTo: accountId },
      { $and: [{ $or: [{ billedTo: { $exists: false } }, { billedTo: null }] }, { user: accountId }] },
    ],
  });
  const dailyLimit = typeof req.user.dailyLimit === "number" ? req.user.dailyLimit : 0;
  const remaining = dailyLimit > 0 ? Math.max(0, dailyLimit - usedToday) : "∞";

  res.render("dashboard", {
    title: "Dashboard — Tyre Inspector",
    stats: {
      total,
      today: todayCount,
      week: weekCount,
      month: monthCount,
      uniqueVrms: Array.isArray(distinctVrms) ? distinctVrms.length : 0,
      latest,
      recent,
    },
    usedToday,
    dailyLimit,
    remaining,
  });
};
