// tests/vrm.spec.js
import { agent } from "./utils/testAgent.js";
import { vi } from "vitest";
import UsageEvent from "../models/usageEvent.model.js";
import User from "../models/user.model.js";

// Mock the VRM lookup util that controller relies on
vi.mock("../utils/vrmLookup.js", async () => {
  const mod = await import("./__mocks__/utils/vrmLookup.js");
  return { default: mod.default };
});

async function registerAndLogin(a, overrides = {}) {
  const payload = {
    name: "Tester",
    email: "tester@example.com",
    password: "pass1234",
    ...overrides,
  };
  const res = await a.post("/register").type("form").send(payload);
  expect(res.status).toBe(302);
  return res;
}

describe("VRM search flow", () => {
  it("logs a vrm_lookup usage event and returns selectable tyre sizes", async () => {
    const a = agent();
    await registerAndLogin(a, { email: "vrm1@example.com" });

    const res = await a
      .post("/vrm")
      .type("form")
      .send({ vrm: "AB12CDE", mileage: "12345" });

    expect(res.status).toBe(200);
    expect(res.text).toMatch(/AB12CDE/);
    expect(res.text).toMatch(/type="radio"[\s\S]*name="tyreSize"/);

    // UsageEvent should be recorded
    const events = await UsageEvent.find({ type: "vrm_lookup" }).lean();
    expect(events.length).toBe(1);
    expect(events[0].meta?.vrm).toBe("AB12CDE");
  });

  it("enforces account daily limit when exceeded", async () => {
    const a = agent();
    await registerAndLogin(a, { email: "limit@example.com" });

    // Set pool daily limit to 1 for the admin
    const admin = await User.findOne({ email: "limit@example.com" });
    admin.dailyLimit = 1;
    await admin.save();

    // First lookup succeeds
    const res1 = await a.post("/vrm").type("form").send({ vrm: "TEST001" });
    expect(res1.status).toBe(200);

    // Second lookup same day -> 429
    const res2 = await a.post("/vrm").type("form").send({ vrm: "TEST002" });
    expect(res2.status).toBe(429);
    expect(res2.text).toMatch(/Account daily limit reached/);
  });
});
