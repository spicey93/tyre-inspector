import { describe, it, beforeAll, afterAll, expect } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

import app from "../app.js";
import User from "../models/user.model.js";
import Inspection from "../models/inspection.model.js";
import Vehicle from "../models/vehicle.model.js";

let mongo;
let code;

describe("EJS render – /inspections?code=XXXXXX (public)", () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    const uri = mongo.getUri();
    if (mongoose.connection.readyState === 0) await mongoose.connect(uri);

    const { _id: adminId } = await User.create({ name: "A", email: "a@a.com", passwordHash: "x", role: "admin" });
    code = await Inspection.generateUniqueCode();

    await Vehicle.create({ vrm: "ZZ99ZZZ", make: "VW", model: "Golf", year: 2019 });

    await Inspection.create({
      user: adminId,
      createdBy: adminId,
      code,
      vrm: "ZZ99ZZZ",
      mileage: 321,
      offside: { front: {}, rear: {} },
      nearside: { front: {}, rear: {} },
    });
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase().catch(() => {});
    await mongoose.disconnect().catch(() => {});
    if (mongo) await mongo.stop();
  });

  it("renders the public show page for a valid code", async () => {
    const res = await request(app).get(`/inspections?code=${code}`);
    expect(res.status).toBe(200);
    // We don’t rely on specific markup—just key data making it to the page
    expect(res.text).toContain("ZZ99ZZZ");
    expect(res.text).toContain(code);
  });

  it("returns 404 for unknown code", async () => {
    const res = await request(app).get(`/inspections?code=NOPE12`);
    expect(res.status).toBe(404);
  });

  it("returns 400 for bad format", async () => {
    const res = await request(app).get(`/inspections?code=abc`);
    expect(res.status).toBe(400);
  });
});
