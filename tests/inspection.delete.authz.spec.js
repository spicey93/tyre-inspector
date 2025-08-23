import { describe, it, beforeAll, afterAll, expect } from "vitest";
import request from "supertest";

import app from "../app.js";
import User from "../models/user.model.js";
import Inspection from "../models/inspection.model.js";
import { connectTestDB, disconnectTestDB } from "./setupTestDB.js";

let ownerAgent, otherAdminAgent, techAgent;
let owner, inspection;

async function makeAgent(email, role = "admin", ownerId = null, password = "pass1234") {
  await request(app).post("/register").type("form").send({ name: "Test User", email, password });
  const u = await User.findOne({ email });
  if (role !== "admin") u.role = role;
  if (role === "technician") u.owner = ownerId;
  await u.save();

  const a = request.agent(app);
  await a.post("/login").type("form").send({ email, password, next: "/dashboard" });
  return a;
}

describe("Inspection delete authorisation", () => {
  beforeAll(async () => {
    await connectTestDB();

    ownerAgent = await makeAgent("owner@example.com", "admin");
    otherAdminAgent = await makeAgent("otheradmin@example.com", "admin");
    owner = await User.findOne({ email: "owner@example.com" });
    techAgent = await makeAgent("t1@example.com", "technician", owner._id);

    const code = await Inspection.generateUniqueCode();
    inspection = await Inspection.create({
      user: owner._id,
      createdBy: owner._id,
      code,
      vrm: "ZZ99ZZZ",
    });
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  it("blocks technician from deleting", async () => {
    const res = await techAgent.delete(`/inspections/${inspection._id}`);
    expect(res.status).toBe(403);
  });

  it("blocks other admin (not owner) from deleting", async () => {
    const res = await otherAdminAgent.delete(`/inspections/${inspection._id}`);
    expect([401, 403, 404]).toContain(res.status);
  });

  it("allows owning admin to delete", async () => {
    const res = await ownerAgent.delete(`/inspections/${inspection._id}`);
    expect([200, 202, 204]).toContain(res.status);
  });
});
