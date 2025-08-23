// tests/inspection.showByCode.spec.js
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";

import app from "../app.js";
import User from "../models/user.model.js";
import Inspection from "../models/inspection.model.js";

let mongo;

describe("Show inspection by code", () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    const uri = mongo.getUri();
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(uri);
    }

    const user = await User.create({ name: "Admin", email: "a@a.com", passwordHash: "x", role: "admin" });
    const code = await Inspection.generateUniqueCode();
    await Inspection.create({ user: user._id, createdBy: user._id, code, vrm: "XX11YYY" });
  });

  afterAll(async () => {
    await mongoose.disconnect().catch(() => {});
    if (mongo) await mongo.stop();
  });

  it("returns 200 and renders when code is valid", async () => {
    const inspection = await Inspection.findOne().lean();
    const res = await request(app).get(`/inspections?code=${inspection.code}`);
    expect([200]).toContain(res.status);
  });

  it("returns 404 for a non-existent code", async () => {
    const res = await request(app).get(`/inspections?code=ZZZZZZ`);
    expect(res.status).toBe(404);
  });

  it("returns 400 for badly formatted code", async () => {
    const res = await request(app).get(`/inspections?code=bad`);
    expect(res.status).toBe(400);
  });
});
