// tests/inspection.update.spec.js
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import request from "supertest";

import app from "../app.js";
import User from "../models/user.model.js";
import Inspection from "../models/inspection.model.js";
import { connectTestDB, disconnectTestDB } from "./setupTestDB.js";

let adminAgent, otherAdminAgent, owner, inspection;

async function makeAgent(email, role = "admin", password = "pass1234") {
  await request(app).post("/register").type("form").send({ name: "User", email, password });
  const u = await User.findOne({ email });
  u.role = role;
  await u.save();
  const a = request.agent(app);
  await a.post("/login").type("form").send({ email, password, next: "/dashboard" });
  return a;
}

describe("Inspection update authorisation", () => {
  beforeAll(async () => {
    await connectTestDB();

    adminAgent = await makeAgent("owner@upd.com", "admin");
    otherAdminAgent = await makeAgent("other@upd.com", "admin");
    owner = await User.findOne({ email: "owner@upd.com" });

    const code = await Inspection.generateUniqueCode();
    inspection = await Inspection.create({
      user: owner._id,
      createdBy: owner._id,
      code,
      vrm: "UPD999",
      mileage: 100,
      notes: "initial",
    });
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  it("allows owning admin to update mileage/notes", async () => {
    const res = await adminAgent.post(`/inspections/${inspection._id}/update`)
      .type("form").send({ mileage: 150, notes: "updated" });
    expect([200, 302]).toContain(res.status);

    const updated = await Inspection.findById(inspection._id);
    expect(updated.mileage).toBe(150);
    expect(updated.notes).toBe("updated");
  });

  it("blocks other admin from updating someone else’s inspection", async () => {
    const res = await otherAdminAgent.post(`/inspections/${inspection._id}/update`)
      .type("form").send({ mileage: 999 });
    expect([401, 403, 404]).toContain(res.status);
  });
});
