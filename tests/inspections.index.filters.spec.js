// tests/inspections.index.filters.spec.js
import { describe, it, expect } from "vitest";
import { agent as mkAgent } from "./utils/testAgent.js";
import User from "../models/user.model.js";
import Inspection from "../models/inspection.model.js";

function utcDate(y, m, d, h = 12) {
  return new Date(Date.UTC(y, m, d, h, 0, 0));
}

async function seedAndLogin() {
  const a = mkAgent();
  const email = "owner@example.com";
  await a.post("/register").type("form").send({ name: "Owner", email, password: "pass1234" });
  await a.post("/login").type("form").send({ email, password: "pass1234", next: "/inspections" });
  const admin = await User.findOne({ email }).lean();

  const docs = [
    { code: "AAAAAA", vrm: "NU59WEP", mileage: 12345, createdAt: utcDate(2024, 10, 2) },
    { code: "BBBBBB", vrm: "AB12CDE", mileage: 23456, createdAt: utcDate(2024, 10, 5) },
    { code: "CCCCCC", vrm: "ZZ99ZZZ", mileage: 34567, createdAt: utcDate(2024, 10, 7) },
  ].map((i) => ({
    ...i,
    user: admin._id,
    offside: { front: {}, rear: {} },
    nearside: { front: {}, rear: {} },
    updatedAt: i.createdAt,
  }));

  await Inspection.insertMany(docs);
  return { a };
}

describe("Inspections Index filters", () => {
  it("lists all by default", async () => {
    const { a } = await seedAndLogin();
    const res = await a.get("/inspections").redirects(1);
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/AAAAAA/);
    expect(res.text).toMatch(/BBBBBB/);
    expect(res.text).toMatch(/CCCCCC/);
  });

  it("filters by search (VRM)", async () => {
    const { a } = await seedAndLogin();
    const res = await a.get("/inspections").query({ search: "AB12" }).redirects(1);
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/BBBBBB/);
    expect(res.text).not.toMatch(/AAAAAA/);
    expect(res.text).not.toMatch(/CCCCCC/);
  });

  it("filters by search (Code)", async () => {
    const { a } = await seedAndLogin();
    const res = await a.get("/inspections").query({ search: "CCCCCC" }).redirects(1);
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/CCCCCC/);
    expect(res.text).not.toMatch(/AAAAAA/);
    expect(res.text).not.toMatch(/BBBBBB/);
  });

  it("filters by date range", async () => {
    const { a } = await seedAndLogin();
    // From 2024-11-03 to 2024-11-06 should only include BBBBBB (created on 5th)
    const res = await a.get("/inspections").query({ from: "2024-11-03", to: "2024-11-06" }).redirects(1);
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/BBBBBB/);
    expect(res.text).not.toMatch(/AAAAAA/);
    expect(res.text).not.toMatch(/CCCCCC/);
  });
});
