// middleware/enforceDailyLimit.js
// Drop-in replacement to fix the “last lookup blocks creation” bug.
//
// Behavior:
// - If the user is under their daily limit -> allow as usual.
// - If the user is AT their limit -> still allow GET /inspections/new?vrm=... and
//   POST /inspections (with body.vrm) WHEN there is a *recent* (last 15 min)
//   UsageEvent of type "vrm_lookup" for the same VRM by the same user.
//   This treats the final lookup as part of the creation flow it enabled.
//
// This does not require session state or UI changes. It infers intent from the
// database trail (recent vrm_lookup for the same VRM).
//
// You can tweak the window by changing RECENT_WINDOW_MS.

import UsageEvent from "../models/usageEvent.model.js";

const RECENT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function utcDayRange(d = new Date()) {
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0));
  const end   = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0));
  return { start, end };
}

function getRequestedVrm(req) {
  const q = (req.query?.vrm || req.body?.vrm || "").toString().toUpperCase().trim();
  return q || null;
}

export default async function enforceDailyLimit(req, res, next) {
  try {
    const dailyLimit = typeof req.user?.dailyLimit === "number" ? req.user.dailyLimit : 0;

    // No limit configured -> allow
    if (!dailyLimit || dailyLimit <= 0) return next();

    // Count all usage events for today (UTC)
    const { start, end } = utcDayRange();
    const usedToday = await UsageEvent.countDocuments({
      user: req.user._id,
      createdAt: { $gte: start, $lt: end },
    });

    // Under limit -> allow
    if (usedToday < dailyLimit) return next();

    // At limit. Consider a grace path if this request is clearly part of
    // an inspection creation flow following a VRM lookup.
    const method = (req.method || "GET").toUpperCase();
    const vrm = getRequestedVrm(req);

    // Heuristic: the creation flow always carries a VRM:
    // - GET /inspections/new?vrm=...
    // - POST /inspections with body.vrm
    const isPotentialCreateFlow = !!vrm && (method === "GET" || method === "POST");

    if (isPotentialCreateFlow) {
      const since = new Date(Date.now() - RECENT_WINDOW_MS);

      // Look for a *recent* vrm_lookup for the same VRM by this user
      const recentLookup = await UsageEvent.findOne({
        user: req.user._id,
        type: "vrm_lookup",
        "meta.vrm": vrm,
        createdAt: { $gte: since },
      }).lean();

      if (recentLookup) {
        // Soft-bypass: allow this request to go through.
        // (Optional) mark for downstream logging/analytics.
        req._limitBypassedDueToRecentLookup = true;
        return next();
      }
    }

    // Otherwise, hard stop
    return res.status(429).send("Daily limit reached");
  } catch (err) {
    // Fail-open to avoid blocking users on unexpected errors
    console.error("enforceDailyLimit middleware error:", err);
    return next();
  }
}
