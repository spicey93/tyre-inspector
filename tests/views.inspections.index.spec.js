import { describe, it, beforeAll, afterAll, expect } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

import app from "../app.js";
import User from "../models/user.model.js";
import Inspection from "../models/inspection.model.js";

let mongo;
let adminAgent;
let admin;

async function makeAgent(email, password = "pass1234") {
  await request(app).post("/register").type("form").send({ name: "Admin", email, password });
  const a = request.agent(app);
  await a.post("/login").type("form").send({ email, password, next: "/dashboard" });
  return a;
}

describe("EJS render – /inspections index", () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    const uri = mongo.getUri();
    if (mongoose.connection.readyState === 0) await mongoose.connect(uri);

    adminAgent = await makeAgent("index-admin@example.com");
    admin = await User.findOne({ email: "index-admin@example.com" });

    // seed a couple of inspections this admin owns
    const code1 = await Inspection.generateUniqueCode();
    const code2 = await Inspection.generateUniqueCode();

    await Inspection.create([
      { user: admin._id, createdBy: admin._id, code: code1, vrm: "AA11AAA", offside:{front:{},rear:{}}, nearside:{front:{},rear:{}}, mileage: 100 },
      { user: admin._id, createdBy: admin._id, code: code2, vrm: "BB22BBB", offside:{front:{},rear:{}}, nearside:{front:{},rear:{}}, mileage: 200 },
    ]);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase().catch(() => {});
    await mongoose.disconnect().catch(() => {});
    if (mongo) await mongo.stop();
  });

  it("renders the index with table rows and UI markers", async () => {
    const res = await adminAgent.get("/inspections");
    expect(res.status).toBe(200);
    expect(res.text).toContain("Inspections");         // page heading
    expect(res.text).toContain("Results");             // section title
    expect(res.text).toContain("Create Inspection");   // button
    // At least one seeded VRM/code visible
    expect(res.text).toMatch(/AA11AAA|BB22BBB/);
  });
});
