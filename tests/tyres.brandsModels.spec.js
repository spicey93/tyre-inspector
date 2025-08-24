// tests/tyres.brandsModels.spec.js
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

import app from "../app.js";
import Tyre from "../models/tyre.model.js";

let mongo;

describe("Tyre API lookups", () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    const uri = mongo.getUri();

    // 🔧 Ensure no stray connection from another suite
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect().catch(() => {});
    }
    await mongoose.connect(uri);

    await Tyre.create({ brand: "Michelin", models: ["Pilot Sport", "Energy"] });
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase().catch(() => {});
    await mongoose.disconnect().catch(() => {});
    if (mongo) await mongo.stop();
  });

  it("lists tyre brands", async () => {
    const res = await request(app).get("/inspections/api/tyres/brands");
    expect(res.status).toBe(200);
    expect(res.body).toContain("Michelin");
  });

  it("lists models for a brand", async () => {
    const res = await request(app).get("/inspections/api/tyres/models?brand=MICHELIN");
    expect(res.status).toBe(200);
    expect(res.body).toContain("CROSSCLIMATE");
  });

  it("returns empty array if brand missing", async () => {
    const res = await request(app).get("/inspections/api/tyres/models");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
