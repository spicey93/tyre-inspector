// tests/inspection.create.implicit-usage.spec.js
import { describe, it, expect } from "vitest";
import { agent as mkAgent } from "./utils/testAgent.js";
import User from "../models/user.model.js";
import Vehicle from "../models/vehicle.model.js";
import Tyre from "../models/tyre.model.js";
import UsageEvent from "../models/usageEvent.model.js";

async function registerAndLogin(email = "admin@impl.com", password = "pass1234") {
  const a = mkAgent();
  await a.post("/register").type("form").send({ name: "Admin", email, password });
  // login to get session cookie
  await a.post("/login").type("form").send({ email, password, next: "/dashboard" });
  const admin = await User.findOne({ email }).lean();
  return { a, admin };
}

function fieldsForAllWheels() {
  const base = (pos) => ({
    [`${pos}.size`]: "225/45R17 91W",
    [`${pos}.brand`]: "BrandX",
    [`${pos}.model`]: "ModelY",
    [`${pos}.treadDepth.inner`]: "5",
    [`${pos}.treadDepth.middle`]: "5",
    [`${pos}.treadDepth.outer`]: "5",
  });
  return {
    ...base("offside.front"),
    ...base("offside.rear"),
    ...base("nearside.front"),
    ...base("nearside.rear"),
  };
}

describe("Implicit VRM usage logging on inspection create", () => {
  it("creates a usage event if none exists for the VRM today", async () => {
    const { a, admin } = await registerAndLogin();

    // seed a simple vehicle + tyre brand/models for the form
    await Vehicle.create({
      vrm: "AB12CDE",
      make: "TestMake",
      model: "TestModel",
      year: "2021",
      torque: "120",
      tyreRecords: [{ front: { size: "225/45R17 91W", pressure: 32 }, rear: { size: "225/45R17 91W", pressure: 32 } }],
    });
    await Tyre.create({ brand: "BrandX", models: ["ModelY"] });

    const before = await UsageEvent.countDocuments({
      user: admin._id,
      type: "vrm_lookup",
      "meta.vrm": "AB12CDE",
    });

    const res = await a
      .post("/inspections")
      .type("form")
      .send({
        vrm: "AB12CDE",
        mileage: "12345",
        notes: "ok",
        ...fieldsForAllWheels(),
      });

    expect(res.status).toBe(302);
    const after = await UsageEvent.countDocuments({
      user: admin._id,
      type: "vrm_lookup",
      "meta.vrm": "AB12CDE",
    });
    expect(after).toBe(before + 1);
  });

  it("does NOT duplicate usage event for the same VRM later the same day", async () => {
    const { a, admin } = await registerAndLogin();

    await Vehicle.create({
      vrm: "AB12CDE",
      make: "TestMake",
      model: "TestModel",
      year: "2021",
      torque: "120",
      tyreRecords: [{ front: { size: "225/45R17 91W", pressure: 32 }, rear: { size: "225/45R17 91W", pressure: 32 } }],
    });
    await Tyre.create({ brand: "BrandX", models: ["ModelY"] });

    // first create triggers usage event
    await a.post("/inspections").type("form").send({
      vrm: "AB12CDE",
      mileage: "12345",
      notes: "first",
      ...fieldsForAllWheels(),
    });

    const before = await UsageEvent.countDocuments({
      user: admin._id,
      type: "vrm_lookup",
      "meta.vrm": "AB12CDE",
    });

    // second create same day should not add another
    const res = await a.post("/inspections").type("form").send({
      vrm: "AB12CDE",
      mileage: "12346",
      notes: "second",
      ...fieldsForAllWheels(),
    });
    expect(res.status).toBe(302);

    const after = await UsageEvent.countDocuments({
      user: admin._id,
      type: "vrm_lookup",
      "meta.vrm": "AB12CDE",
    });
    expect(after).toBe(before);
  });
});
