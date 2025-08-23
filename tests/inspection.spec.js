// tests/inspection.spec.js
import { agent } from "./utils/testAgent.js";
import { vi } from "vitest";
import Inspection from "../models/inspection.model.js";

// Mock VRM lookup (so /inspections/new prefill works if you go via /vrm beforehand)
vi.mock("../utils/vrmLookup.js", async () => {
  const mod = await import("./__mocks__/utils/vrmLookup.js");
  return { default: mod.default };
});

async function login(a) {
  const email = "inspector@example.com";
  await a.post("/register").type("form").send({ name: "Insp", email, password: "x" });
}

describe("Create inspection", () => {
  it("saves an inspection and redirects to dashboard", async () => {
    const a = agent();
    await login(a);

    // Hit /vrm to build the selection + log usage (mimics real flow)
    await a.post("/vrm").type("form").send({ vrm: "ZZ99AAA", mileage: "45678" });

    // Jump to /inspections/new to render form (server-side), then post create
    const newPage = await a.get("/inspections/new").query({ vrm: "ZZ99AAA", tyreSize: encodeURIComponent("225/45R17 91W"), mileage: "45678" });
    expect(newPage.status).toBe(200);
    expect(newPage.text).toMatch(/New Inspection/);

    const payload = {
      vrm: "ZZ99AAA",
      mileage: 45678,
      notes: "All ok.",
      "offside.front.size": "225/45R17 91W",
      "offside.front.pressure": 32,
      "offside.front.brand": "BrandX",
      "offside.front.model": "ModelY",
      "offside.front.treadDepth.inner": 6,
      "offside.front.treadDepth.middle": 6,
      "offside.front.treadDepth.outer": 6,

      "nearside.front.size": "225/45R17 91W",
      "nearside.front.pressure": 32,
      "nearside.front.brand": "BrandX",
      "nearside.front.model": "ModelY",
      "nearside.front.treadDepth.inner": 6,
      "nearside.front.treadDepth.middle": 6,
      "nearside.front.treadDepth.outer": 6,

      "offside.rear.size": "225/45R17 91W",
      "offside.rear.pressure": 34,
      "offside.rear.brand": "BrandX",
      "offside.rear.model": "ModelY",
      "offside.rear.treadDepth.inner": 5.5,
      "offside.rear.treadDepth.middle": 5.5,
      "offside.rear.treadDepth.outer": 5.5,

      "nearside.rear.size": "225/45R17 91W",
      "nearside.rear.pressure": 34,
      "nearside.rear.brand": "BrandX",
      "nearside.rear.model": "ModelY",
      "nearside.rear.treadDepth.inner": 5.5,
      "nearside.rear.treadDepth.middle": 5.5,
      "nearside.rear.treadDepth.outer": 5.5,
    };

    const postRes = await a.post("/inspections").type("form").send(payload);
    expect(postRes.status).toBe(302);
    expect(postRes.headers.location).toMatch(/^\/dashboard\?created=/);

    const saved = await Inspection.findOne({ vrm: "ZZ99AAA" }).lean();
    expect(saved).toBeTruthy();
    expect(saved.code).toHaveLength(6);
    expect(saved.offside?.front?.brand).toBe("BrandX");
  });
});
