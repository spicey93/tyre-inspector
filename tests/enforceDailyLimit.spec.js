// tests/enforceDailyLimit.spec.js
import enforceDailyLimit from "../middleware/enforceDailyLimit.js";
import UsageEvent from "../models/usageEvent.model.js";
import User from "../models/user.model.js";

function mockReqRes(user, { method = "POST", body = {}, query = {} } = {}) {
  const req = { method, body, query, user };
  const res = {
    statusCode: 200,
    _headers: {},
    status(code) { this.statusCode = code; return this; },
    send(msg) { this.body = msg; return this; },
    set() {},
  };
  const next = vi.fn();
  return { req, res, next };
}

describe("enforceDailyLimit middleware", () => {
  it("allows when under both pool & actor limits", async () => {
    // Admin (pool owner)
    const admin = await User.create({
      name: "Admin",
      email: "admin@x.com",
      passwordHash: "x",
      role: "admin",
      dailyLimit: 2,
    });

    // Technician capped at 1 per day
    const tech = await User.create({
      name: "Tech",
      email: "tech@x.com",
      passwordHash: "x",
      role: "technician",
      owner: admin._id,
      dailyLimit: 1,
      active: true,
    });

    const { req, res, next } = mockReqRes(tech, { method: "POST", body: { vrm: "VRM123" } });
    await enforceDailyLimit(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("blocks technician when actor limit reached (no recent-lookup grace)", async () => {
    const admin = await User.create({
      name: "Admin2",
      email: "admin2@x.com",
      passwordHash: "x",
      role: "admin",
      dailyLimit: 99,
    });

    const tech = await User.create({
      name: "Tech2",
      email: "tech2@x.com",
      passwordHash: "x",
      role: "technician",
      owner: admin._id,
      dailyLimit: 1,
      active: true,
    });

    // Consume the tech's personal limit
    await UsageEvent.create({
      user: tech._id,
      billedTo: admin._id,
      type: "vrm_lookup",
      meta: { vrm: "VRM-A", reason: "explicit_lookup" },
    });

    const { req, res, next } = mockReqRes(tech, { method: "POST", body: { vrm: "VRM-B" } });
    await enforceDailyLimit(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(429);
    expect(res.body).toMatch(/Technician daily limit reached/);
  });

  it("permits when recent lookup exists for same VRM (grace window)", async () => {
    const admin = await User.create({
      name: "Admin3",
      email: "admin3@x.com",
      passwordHash: "x",
      role: "admin",
      dailyLimit: 1,
    });

    const tech = await User.create({
      name: "Tech3",
      email: "tech3@x.com",
      passwordHash: "x",
      role: "technician",
      owner: admin._id,
      dailyLimit: 1,
      active: true,
    });

    // Consume both pool & actor limits, but record a *recent* lookup for VRM "RECENT1"
    await UsageEvent.create({
      user: tech._id,
      billedTo: admin._id,
      type: "vrm_lookup",
      meta: { vrm: "RECENT1", reason: "explicit_lookup" },
      createdAt: new Date(), // now is within the 15-min grace window
    });

    const { req, res, next } = mockReqRes(tech, { method: "POST", body: { vrm: "RECENT1" } });
    await enforceDailyLimit(req, res, next);

    // Should pass through due to grace
    expect(next).toHaveBeenCalledTimes(1);
  });
});
