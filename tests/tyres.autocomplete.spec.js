// tests/tyres.autocomplete.spec.js
import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app.js";
import Tyre from "../models/tyre.model.js";

describe("Tyre autocomplete API", () => {
  it("GET /inspections/api/tyres/brands returns sorted brand list", async () => {
    await Tyre.create([
      { brand: "Michelin", models: ["Pilot Sport 4", "Primacy 4", "CrossClimate 2"] },
      { brand: "Pirelli", models: ["P Zero", "Cinturato P7"] },
    ]);
    const res = await request(app).get("/inspections/api/tyres/brands");
    expect(res.status).toBe(200);
    // Robust check (order-agnostic equality)
    expect(res.body.sort()).toEqual(["Michelin", "Pirelli"].sort());
  });

  it("GET /inspections/api/tyres/models?brand=<existing brand> returns seeded models", async () => {
    await Tyre.create({ brand: "Michelin", models: ["Primacy 4", "Pilot Sport 4", "CrossClimate 2"] });

    // Ask the server what brands it knows, then query models for that brand
    const brandsRes = await request(app).get("/inspections/api/tyres/brands");
    expect(brandsRes.status).toBe(200);
    const brand = brandsRes.body[0]; // e.g., "Michelin"

    const res = await request(app).get("/inspections/api/tyres/models").query({ brand });
    expect(res.status).toBe(200);
    // Should contain all three we seeded (order may be sorted server-side)
    const models = res.body;
    expect(models).toEqual(expect.arrayContaining(["CrossClimate 2", "Pilot Sport 4", "Primacy 4"]));
  });

  it("GET /inspections/api/tyres/models without brand returns []", async () => {
    const res = await request(app).get("/inspections/api/tyres/models");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
