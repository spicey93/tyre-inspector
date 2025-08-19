// controllers/dashboard.controller.js
import Inspection from "../models/inspection.model.js";
import User from "../models/user.model.js";

export const dashboard = async (req, res) => {
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = 15;
  const skip = (page - 1) * limit;

  let userIds = [req.user._id];
  if (req.user.role === "admin") {
    const techs = await User.find({ admin: req.user._id }, "_id").lean();
    userIds = userIds.concat(techs.map((t) => t._id));
  }

  const q = { user: { $in: userIds } };
  const [items, total] = await Promise.all([
    Inspection.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Inspection.countDocuments(q),
  ]);

  // today usage (UTC)
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
  const end   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
  const usedToday = await Inspection.countDocuments({ user: { $in: userIds }, createdAt: { $gte: start, $lt: end } });
  const dailyLimit = typeof req.user.dailyLimit === "number" ? req.user.dailyLimit : 0;
  const remaining = dailyLimit > 0 ? Math.max(0, dailyLimit - usedToday) : "∞";

  res.render("dashboard", {
    items,
    total,
    page,
    pages: Math.ceil(total / limit),
    usedToday,
    dailyLimit,
    remaining,
    query: req.query, // ✅ so the view can read ?created=CODE
  });
};

