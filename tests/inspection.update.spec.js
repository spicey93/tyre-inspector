// tests/inspection.update.spec.js
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";

import app from "../app.js";
import User from "../models/user.model.js";
import Inspection from "../models/inspection.model.js";

let mongo, adminAgent, otherAgent, inspection;

async function makeAgent(email) {
  await request(app).post("/register").type("form").send({ name: "Test", email, password: "pass" });
  const u = await User.findOne({ email });
  u.role = "admin";
  await u.save();
  const a = request.agent(app);
  await a.post("/login").type("form").send({ email, password: "pass" });
  return a;
}

describe("Inspection update authorisation", () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    const uri = mongo.getUri();
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(uri);
    }

    adminAgent = await makeAgent("owner@upd.com");
    otherAgent = await makeAgent("other@upd.com");

    const owner = await User.findOne({ email: "owner@upd.com" });
    const code = await Inspection.generateUniqueCode();
    inspection = await Inspection.create({
      user: owner._id,
      createdBy: owner._id,
      code,
      vrm: "AA11AAA",
    });
  });

  afterAll(async () => {
    await mongoose.disconnect().catch(() => {});
    if (mongo) await mongo.stop();
  });

  it("allows owning admin to update mileage/notes", async () => {
    const res = await adminAgent.post(`/inspections/${inspection._id}/update`).type("form").send({ mileage: 500, notes: "updated" });
    expect([200, 302]).toContain(res.status);
  });

  it("blocks other admin from updating someone else’s inspection", async () => {
    const res = await otherAgent.post(`/inspections/${inspection._id}/update`).type("form").send({ mileage: 600 });
    expect([401, 403, 404]).toContain(res.status);
  });
});
