// tests/inspection.showByCode.spec.js
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import request from "supertest";

import app from "../app.js";
import User from "../models/user.model.js";
import Inspection from "../models/inspection.model.js";
import { connectTestDB, disconnectTestDB } from "./setupTestDB.js";

let adminAgent, code;

describe("Show inspection by code", () => {
  beforeAll(async () => {
    await connectTestDB();

    // make admin
    await request(app).post("/register").type("form").send({
      name: "Boss", email: "boss@show.com", password: "pass1234"
    });
    const u = await User.findOne({ email: "boss@show.com" });

    // login
    adminAgent = request.agent(app);
    await adminAgent.post("/login").type("form").send({ email: "boss@show.com", password: "pass1234" });

    // seed inspection
    code = await Inspection.generateUniqueCode();
    await Inspection.create({
      user: u._id,
      code,
      vrm: "AA11AAA",
    });
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  it("returns 200 and renders when code is valid", async () => {
    const res = await adminAgent.get(`/inspections?code=${code}`);
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/AA11AAA/);
  });

  it("returns 404 for a non-existent code", async () => {
    const res = await adminAgent.get("/inspections?code=ZZZZZZ");
    expect(res.status).toBe(404);
  });

  it("returns 400 for badly formatted code", async () => {
    const res = await adminAgent.get("/inspections?code=abc");
    expect(res.status).toBe(400);
  });
});
