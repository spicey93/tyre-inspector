import UsageEvent from "../models/usageEvent.model.js";

export default async function enforceDailyLimit(req, res, next) {
  try {
    if (!req.user) return res.redirect("/login?next=" + encodeURIComponent(req.originalUrl));
    const limit = typeof req.user.dailyLimit === "number" ? req.user.dailyLimit : 0;

    if (req.user.role === "admin" || limit <= 0) return next(); // <=0 = unlimited

    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
    const end   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));

    const used = await UsageEvent.countDocuments({
      user: req.user._id,
      createdAt: { $gte: start, $lt: end },
    });

    if (used >= limit) {
      return res.status(429).render("limits/limit-reached", {
        used, limit,
        title: "Daily limit reached",
      });
    }

    res.locals.limitInfo = { used, limit, remaining: Math.max(0, limit - used) };
    next();
  } catch (e) {
    console.error(e);
    res.status(500).send("Could not verify limit");
  }
}
