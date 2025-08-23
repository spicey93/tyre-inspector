// controllers/dashboard.controller.js
import Inspection from "../models/inspection.model.js";
import UsageEvent from "../models/usageEvent.model.js";

function startOfDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function startOfWeek(d = new Date()) {
  // Week starts Monday
  const day = d.getDay() || 7; // Sun=0 -> 7
  const monday = new Date(d);
  monday.setDate(d.getDate() - (day - 1));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export const dashboard = async (req, res) => {
  const userId = req.user._id;

  const today = startOfDay();
  const weekStart = startOfWeek();
  const monthStart = startOfMonth();

  const [
    total,
    todayCount,
    weekCount,
    monthCount,
    distinctVrms,
    latest
  ] = await Promise.all([
    Inspection.countDocuments({ user: userId }),
    Inspection.countDocuments({ user: userId, createdAt: { $gte: today } }),
    Inspection.countDocuments({ user: userId, createdAt: { $gte: weekStart } }),
    Inspection.countDocuments({ user: userId, createdAt: { $gte: monthStart } }),
    Inspection.distinct("vrm", { user: userId }),
    Inspection.findOne({ user: userId }).sort({ createdAt: -1 }).lean()
  ]);

  // Daily VRM usage (limit/pill context)
  const now = new Date();
  const startUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
  const endUTC   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
  const usedToday = await UsageEvent.countDocuments({ user: userId, createdAt: { $gte: startUTC, $lt: endUTC } });
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
    },
    usedToday,
    dailyLimit,
    remaining
  });
};
