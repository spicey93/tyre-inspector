// tests/views.inspections.show.spec.js
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import app from "../app.js";
import Inspection from "../models/inspection.model.js";

let mongo, code;

describe("views: inspections/show.ejs", () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    if (mongoose.connection.readyState === 0) await mongoose.connect(mongo.getUri());

    code = await Inspection.generateUniqueCode();
    await Inspection.create({
      user: new mongoose.Types.ObjectId(),
      createdBy: new mongoose.Types.ObjectId(),
      code,
      vrm: "AB12CDE",
      mileage: 456,
      notes: "hello world",
      offside: { front: {}, rear: {} },
      nearside: { front: {}, rear: {} },
    });
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase().catch(() => {});
    await mongoose.disconnect().catch(() => {});
    await mongo.stop();
  });

  it("renders HTML with the inspection details", async () => {
    const res = await request(app).get(`/inspections?code=${code}`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/html/);

    const html = res.text;
    expect(html).toMatch(code);         // shows the share code
    expect(html).toMatch("AB12CDE");    // shows the VRM
    expect(html).toMatch(/hello world/i); // shows notes
  });
});
