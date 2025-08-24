import { describe, it, beforeAll, afterAll, expect } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

import app from "../app.js";
import User from "../models/user.model.js";
import Vehicle from "../models/vehicle.model.js";
import Tyre from "../models/tyre.model.js";

let mongo;
let adminAgent;

async function makeAgent(email, password = "pass1234") {
  await request(app).post("/register").type("form").send({ name: "Admin", email, password });
  const a = request.agent(app);
  await a.post("/login").type("form").send({ email, password, next: "/dashboard" });
  return a;
}

describe("EJS render – /inspections/new", () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    const uri = mongo.getUri();
    if (mongoose.connection.readyState === 0) await mongoose.connect(uri);

    adminAgent = await makeAgent("new-admin@example.com");

    await Vehicle.create({ vrm: "NU59 WEP", make: "Ford", model: "Focus", year: 2012 });
    await Tyre.create({ brand: "MICHELIN", models: ["CROSSCLIMATE", "PRIMACY 4"] });
    await Tyre.create({ brand: "PIRELLI", models: ["P ZERO", "CINTURATO"] });
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase().catch(() => {});
    await mongoose.disconnect().catch(() => {});
    if (mongo) await mongo.stop();
  });

  it("renders form with vehicle summary and brand datalist", async () => {
    const res = await adminAgent.get("/inspections/new?vrm=NU59%20WEP&mileage=12345");
    expect(res.status).toBe(200);
    expect(res.text).toContain("New Inspection");
    expect(res.text).toContain("NU59 WEP");
    expect(res.text).toContain("Ford Focus");
    // shared brand datalist id exists and includes brands
    expect(res.text).toContain('datalist id="brands-list"');
    expect(res.text).toContain("MICHELIN");
    expect(res.text).toContain("PIRELLI");
  });
});
