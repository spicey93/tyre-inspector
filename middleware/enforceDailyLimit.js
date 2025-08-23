// middleware/enforceDailyLimit.js
// Pool-aware + per-technician caps, with "recent-lookup" grace to finish an in-flight creation flow.
import UsageEvent from "../models/usageEvent.model.js";
import User from "../models/user.model.js";

const RECENT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function utcDayRange(d = new Date()) {
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0));
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0));
  return { start, end };
}

function getRequestedVrm(req) {
  const q = (req.query?.vrm || req.body?.vrm || "").toString().toUpperCase().trim();
  return q || null;
}

export default async function enforceDailyLimit(req, res, next) {
  try {
    // Ensure locals object exists even in tests/mocks
    res.locals = res.locals || {};

    if (!req.user?._id) return res.status(401).send("Login required");

    // Determine the billing account (admin) and the actor (may be a technician)
    const isTech = req.user.role === "technician" && req.user.owner;
    const accountId = isTech ? req.user.owner : req.user._id; // admin who pays
    const actorId = req.user._id;

    // Fetch limits
    const [adminDoc, actorDoc] = await Promise.all([
      User.findById(accountId).select("dailyLimit role").lean(),
      User.findById(actorId).select("dailyLimit role owner active").lean(),
    ]);

    if (isTech && actorDoc?.active === false) {
      return res.status(403).send("Technician is inactive");
    }

    const adminPoolLimit = Number(adminDoc?.dailyLimit || 0);
    const actorLimit = Number(actorDoc?.dailyLimit || 0);

    const { start, end } = utcDayRange();

    // Count today's pool usage and actor usage
    // NOTE: include a migration-safe fallback: if billedTo missing and it's the admin themselves, still count.
    const [usedPool, usedActor] = await Promise.all([
      adminPoolLimit > 0
        ? UsageEvent.countDocuments({
            createdAt: { $gte: start, $lt: end },
            $or: [
              { billedTo: accountId },
              { $and: [{ $or: [{ billedTo: { $exists: false } }, { billedTo: null }] }, { user: accountId }] },
            ],
          })
        : 0,
      actorLimit > 0
        ? UsageEvent.countDocuments({ user: actorId, createdAt: { $gte: start, $lt: end } })
        : 0,
    ]);

    // Helper: allow if request is clearly finishing a create flow after a recent lookup for the same VRM
    async function allowIfRecentLookupForSameVRM() {
      const vrm = getRequestedVrm(req);
      const method = (req.method || "GET").toUpperCase();
      const potentialCreate = !!vrm && (method === "GET" || method === "POST");
      if (!potentialCreate) return false;

      const since = new Date(Date.now() - RECENT_WINDOW_MS);
      const recentLookup = await UsageEvent.findOne({
        user: actorId,
        type: "vrm_lookup",
        "meta.vrm": vrm,
        createdAt: { $gte: since },
      }).lean();
      return !!recentLookup;
    }

    // Per-actor cap (technicians in particular)
    if (isTech && actorLimit > 0 && usedActor >= actorLimit) {
      if (await allowIfRecentLookupForSameVRM()) {
        // still pass through, but expose pool/actor usage info
        res.locals.limitInfo = {
          used: usedPool,
          limit: adminPoolLimit,
          actorUsed: usedActor,
          actorLimit,
        };
        return next();
      }
      return res.status(429).send("Technician daily limit reached");
    }

    // Admin pool cap
    if (adminPoolLimit > 0 && usedPool >= adminPoolLimit) {
      if (await allowIfRecentLookupForSameVRM()) {
        res.locals.limitInfo = {
          used: usedPool,
          limit: adminPoolLimit,
          actorUsed: usedActor,
          actorLimit,
        };
        return next();
      }
      return res.status(429).send("Account daily limit reached");
    }

    // Under limits — expose usage info for downstream (e.g. HX-Trigger updates)
    res.locals.limitInfo = {
      used: usedPool,
      limit: adminPoolLimit,
      actorUsed: usedActor,
      actorLimit,
    };

    return next();
  } catch (err) {
    // Fail-open to avoid blocking users on unexpected errors
    console.error("enforceDailyLimit middleware error:", err);
    return next();
  }
}

