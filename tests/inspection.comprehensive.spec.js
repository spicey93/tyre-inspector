// tests/inspection.comprehensive.spec.js
import { agent } from "./utils/testAgent.js";
import { vi } from "vitest";
import Inspection from "../models/inspection.model.js";
import Vehicle from "../models/vehicle.model.js";
import Tyre from "../models/tyre.model.js";
import User from "../models/user.model.js";
import UsageEvent from "../models/usageEvent.model.js";

// Mock VRM lookup
vi.mock("../utils/vrmLookup.js", async () => {
  const mod = await import("./__mocks__/utils/vrmLookup.js");
  return { default: mod.default };
});

async function createAdminUser(email = "admin@example.com") {
  const a = agent();
  await a.post("/register").type("form").send({ 
    name: "Admin User", 
    email, 
    password: "password123" 
  });
  return await User.findOne({ email }).lean();
}

async function createTestVehicle(vrm = "AB12CDE") {
  return await Vehicle.create({
    vrm,
    make: "Test Make",
    model: "Test Model",
    year: "2020",
    tyreRecords: [{
      front: { size: "225/45R17", pressure: 32 },
      rear: { size: "225/45R17", pressure: 34 }
    }]
  });
}

async function createTestTyre() {
  return await Tyre.create({
    brand: "TestBrand",
    models: ["Model1", "Model2", "Model3"]
  });
}

describe("Inspection Comprehensive Tests", () => {
  describe("Inspection Index (List)", () => {
    it("lists inspections with pagination", async () => {
      const a = agent();
      const admin = await createAdminUser();
      
      // Create multiple inspections
      await Inspection.create([
        { user: admin._id, code: "ABC123", vrm: "AB12CDE", mileage: 50000 },
        { user: admin._id, code: "DEF456", vrm: "CD34FGH", mileage: 60000 },
        { user: admin._id, code: "GHI789", vrm: "EF56IJK", mileage: 70000 }
      ]);

      await a.post("/login").type("form").send({ 
        email: "admin@example.com", 
        password: "password123" 
      });

      const res = await a.get("/inspections");
      expect(res.status).toBe(200);
      expect(res.text).toMatch(/ABC123/);
      expect(res.text).toMatch(/DEF456/);
      expect(res.text).toMatch(/GHI789/);
    });

    it("filters inspections by search term", async () => {
      const a = agent();
      const admin = await createAdminUser();
      
      await Inspection.create([
        { user: admin._id, code: "ABC123", vrm: "AB12CDE" },
        { user: admin._id, code: "DEF456", vrm: "CD34FGH" }
      ]);

      await a.post("/login").type("form").send({ 
        email: "admin@example.com", 
        password: "password123" 
      });

      const res = await a.get("/inspections?search=ABC123");
      expect(res.status).toBe(200);
      expect(res.text).toMatch(/ABC123/);
      expect(res.text).not.toMatch(/DEF456/);
    });

    it("filters inspections by date range", async () => {
      const a = agent();
      const admin = await createAdminUser();
      
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      await Inspection.create([
        { user: admin._id, code: "TODAY1", vrm: "TODAY", createdAt: today },
        { user: admin._id, code: "YEST12", vrm: "YEST", createdAt: yesterday }
      ]);

      await a.post("/login").type("form").send({ 
        email: "admin@example.com", 
        password: "password123" 
      });

      const fromDate = today.toISOString().split('T')[0];
      const res = await a.get(`/inspections?from=${fromDate}`);
      expect(res.status).toBe(200);
      expect(res.text).toMatch(/TODAY1/);
      expect(res.text).not.toMatch(/YEST12/);
    });

    it("shows only user's own inspections", async () => {
      const a = agent();
      const admin1 = await createAdminUser("admin1@example.com");
      const admin2 = await createAdminUser("admin2@example.com");
      
      await Inspection.create([
        { user: admin1._id, code: "ADM123", vrm: "ADMIN1" },
        { user: admin2._id, code: "ADM223", vrm: "ADMIN2" }
      ]);

      await a.post("/login").type("form").send({ 
        email: "admin1@example.com", 
        password: "password123" 
      });

      const res = await a.get("/inspections");
      expect(res.status).toBe(200);
      expect(res.text).toMatch(/ADM123/);
      expect(res.text).not.toMatch(/ADM223/);
    });
  });

  describe("Inspection Show by Code", () => {
    it("shows inspection by valid code", async () => {
      const a = agent();
      const admin = await createAdminUser();
      
      const inspection = await Inspection.create({
        user: admin._id,
        code: "SHOW12",
        vrm: "SHOWVRM",
        mileage: 50000,
        offside: {
          front: { brand: "TestBrand", model: "TestModel", treadDepth: { inner: 6, middle: 6, outer: 6 } },
          rear: { brand: "TestBrand", model: "TestModel", treadDepth: { inner: 5, middle: 5, outer: 5 } }
        },
        nearside: {
          front: { brand: "TestBrand", model: "TestModel", treadDepth: { inner: 6, middle: 6, outer: 6 } },
          rear: { brand: "TestBrand", model: "TestModel", treadDepth: { inner: 5, middle: 5, outer: 5 } }
        }
      });

      const res = await a.get("/inspections?code=SHOW12");
      expect(res.status).toBe(200);
      expect(res.text).toMatch(/SHOW12/);
      expect(res.text).toMatch(/SHOWVRM/);
      expect(res.text).toMatch(/50000/);
    });

    it("returns 404 for invalid code", async () => {
      const a = agent();
      const res = await a.get("/inspections?code=INVALID");
      expect(res.status).toBe(400);
      expect(res.text).toMatch(/Invalid code format/);
    });

    it("returns 404 for non-existent code", async () => {
      const a = agent();
      const res = await a.get("/inspections?code=ABC123");
      expect(res.status).toBe(404);
      expect(res.text).toMatch(/Inspection not found/);
    });

    it("restricts technician access to own inspections", async () => {
      const a = agent();
      const admin = await createAdminUser();
      
      // Create technician
      await a.post("/login").type("form").send({ 
        email: "admin@example.com", 
        password: "password123" 
      });
      
      await a.post("/technicians").type("form").send({
        name: "Tech User",
        email: "tech@example.com",
        password: "techpass123",
        dailyLimit: "5"
      });
      
      const tech = await User.findOne({ email: "tech@example.com" });
      
      // Create inspections for both admin and tech
      await Inspection.create([
        { user: admin._id, code: "ADMIN1", vrm: "ADMIN" },
        { user: tech._id, code: "TECH12", vrm: "TECH" }
      ]);

      // Login as technician
      await a.post("/login").type("form").send({ 
        email: "tech@example.com", 
        password: "techpass123" 
      });

      // Should be able to see own inspection
      const ownRes = await a.get("/inspections?code=TECH12");
      expect(ownRes.status).toBe(200);
      
      // Should not be able to see admin's inspection
      const otherRes = await a.get("/inspections?code=ADMIN1");
      expect(otherRes.status).toBe(404);
    });
  });

  describe("New Inspection Form", () => {
    it("shows new inspection form with vehicle data", async () => {
      const a = agent();
      const admin = await createAdminUser();
      const vehicle = await createTestVehicle();
      
      await a.post("/login").type("form").send({ 
        email: "admin@example.com", 
        password: "password123" 
      });

      const res = await a.get("/inspections/new")
        .query({ 
          vrm: "AB12CDE", 
          tyreSize: encodeURIComponent("225/45R17 91W"), 
          mileage: "50000" 
        });
      
      expect(res.status).toBe(200);
      expect(res.text).toMatch(/New Inspection/);
      expect(res.text).toMatch(/AB12CDE/);
      expect(res.text).toMatch(/50000/);
    });

    it("returns 400 for missing VRM", async () => {
      const a = agent();
      const admin = await createAdminUser();
      
      await a.post("/login").type("form").send({ 
        email: "admin@example.com", 
        password: "password123" 
      });

      const res = await a.get("/inspections/new");
      expect(res.status).toBe(400);
      expect(res.text).toMatch(/Missing vrm/);
    });

    it("returns 404 for non-existent vehicle", async () => {
      const a = agent();
      const admin = await createAdminUser();
      
      await a.post("/login").type("form").send({ 
        email: "admin@example.com", 
        password: "password123" 
      });

      const res = await a.get("/inspections/new")
        .query({ vrm: "NONEXIST" });
      
      expect(res.status).toBe(404);
      expect(res.text).toMatch(/Vehicle not found/);
    });
  });

  describe("Tyre Brand/Model APIs", () => {
    it("lists all tyre brands", async () => {
      const a = agent();
      await createTestTyre();
      
      const res = await a.get("/inspections/api/tyres/brands");
      expect(res.status).toBe(200);
      expect(JSON.parse(res.text)).toContain("TestBrand");
    });

    it("lists models for specific brand", async () => {
      const a = agent();
      await createTestTyre();
      
      const res = await a.get("/inspections/api/tyres/models?brand=TestBrand");
      expect(res.status).toBe(200);
      const models = JSON.parse(res.text);
      expect(models).toContain("Model1");
      expect(models).toContain("Model2");
      expect(models).toContain("Model3");
    });

    it("returns empty array for non-existent brand", async () => {
      const a = agent();
      const res = await a.get("/inspections/api/tyres/models?brand=NonExistent");
      expect(res.status).toBe(200);
      expect(JSON.parse(res.text)).toEqual([]);
    });

    it("returns empty array for empty brand", async () => {
      const a = agent();
      const res = await a.get("/inspections/api/tyres/models");
      expect(res.status).toBe(200);
      expect(JSON.parse(res.text)).toEqual([]);
    });
  });

  describe("Create Inspection", () => {
    it("creates inspection with complete data", async () => {
      const a = agent();
      const admin = await createAdminUser();
      await createTestVehicle();
      
      await a.post("/login").type("form").send({ 
        email: "admin@example.com", 
        password: "password123" 
      });

      // Hit VRM endpoint first (mimics real flow)
      await a.post("/vrm").type("form").send({ vrm: "AB12CDE", mileage: "50000" });

      const payload = {
        vrm: "AB12CDE",
        mileage: 50000,
        notes: "All tyres in good condition",
        "offside.front.size": "225/45R17 91W",
        "offside.front.pressure": 32,
        "offside.front.brand": "TestBrand",
        "offside.front.model": "TestModel",
        "offside.front.treadDepth.inner": 6,
        "offside.front.treadDepth.middle": 6,
        "offside.front.treadDepth.outer": 6,
        "offside.front.condition": "ok",
        "offside.front.notes": "Good condition",
        "offside.rear.size": "225/45R17 91W",
        "offside.rear.pressure": 34,
        "offside.rear.brand": "TestBrand",
        "offside.rear.model": "TestModel",
        "offside.rear.treadDepth.inner": 5,
        "offside.rear.treadDepth.middle": 5,
        "offside.rear.treadDepth.outer": 5,
        "offside.rear.condition": "ok",
        "nearside.front.size": "225/45R17 91W",
        "nearside.front.pressure": 32,
        "nearside.front.brand": "TestBrand",
        "nearside.front.model": "TestModel",
        "nearside.front.treadDepth.inner": 6,
        "nearside.front.treadDepth.middle": 6,
        "nearside.front.treadDepth.outer": 6,
        "nearside.front.condition": "ok",
        "nearside.rear.size": "225/45R17 91W",
        "nearside.rear.pressure": 34,
        "nearside.rear.brand": "TestBrand",
        "nearside.rear.model": "TestModel",
        "nearside.rear.treadDepth.inner": 5,
        "nearside.rear.treadDepth.middle": 5,
        "nearside.rear.treadDepth.outer": 5,
        "nearside.rear.condition": "ok"
      };

      const res = await a.post("/inspections").type("form").send(payload);
      expect(res.status).toBe(302);
      expect(res.headers.location).toMatch(/\/dashboard\?created=/);

      const saved = await Inspection.findOne({ vrm: "AB12CDE" }).lean();
      expect(saved).toBeTruthy();
      expect(saved.code).toHaveLength(6);
      expect(saved.mileage).toBe(50000);
      expect(saved.notes).toBe("All tyres in good condition");
      expect(saved.offside.front.brand).toBe("TestBrand");
      expect(saved.offside.front.treadDepth.inner).toBe(6);
    });

    it("requires authentication", async () => {
      const a = agent();
      const res = await a.post("/inspections").type("form").send({ vrm: "TEST" });
      expect(res.status).toBe(401);
      expect(res.text).toMatch(/Login required/);
    });

    it("handles missing optional fields", async () => {
      const a = agent();
      const admin = await createAdminUser();
      await createTestVehicle();
      
      await a.post("/login").type("form").send({ 
        email: "admin@example.com", 
        password: "password123" 
      });

      const minimalPayload = {
        vrm: "AB12CDE",
        "offside.front.size": "225/45R17",
        "offside.rear.size": "225/45R17",
        "nearside.front.size": "225/45R17",
        "nearside.rear.size": "225/45R17"
      };

      const res = await a.post("/inspections").type("form").send(minimalPayload);
      expect(res.status).toBe(302);

      const saved = await Inspection.findOne({ vrm: "AB12CDE" }).lean();
      expect(saved).toBeTruthy();
      expect(saved.code).toHaveLength(6);
    });
  });

  describe("Edit Inspection", () => {
    it("shows edit form for admin's own inspection", async () => {
      const a = agent();
      const admin = await createAdminUser();
      
      const inspection = await Inspection.create({
        user: admin._id,
        code: "EDIT12",
        vrm: "EDITVRM",
        mileage: 50000,
        notes: "Original notes"
      });

      await a.post("/login").type("form").send({ 
        email: "admin@example.com", 
        password: "password123" 
      });

      const res = await a.get(`/inspections/${inspection._id}/edit`);
      expect(res.status).toBe(200);
      expect(res.text).toMatch(/Edit Inspection/);
              expect(res.text).toMatch(/EDIT12/);
      expect(res.text).toMatch(/50000/);
    });

    it("returns 404 for non-existent inspection", async () => {
      const a = agent();
      const admin = await createAdminUser();
      
      await a.post("/login").type("form").send({ 
        email: "admin@example.com", 
        password: "password123" 
      });

      const fakeId = "507f1f77bcf86cd799439011";
      const res = await a.get(`/inspections/${fakeId}/edit`);
      expect(res.status).toBe(404);
    });

    it("prevents editing other user's inspection", async () => {
      const a = agent();
      const admin1 = await createAdminUser("admin1@example.com");
      const admin2 = await createAdminUser("admin2@example.com");
      
      const inspection = await Inspection.create({
        user: admin1._id,
        code: "OTHER1",
        vrm: "OTHER",
        mileage: 50000
      });

      await a.post("/login").type("form").send({ 
        email: "admin2@example.com", 
        password: "password123" 
      });

      const res = await a.get(`/inspections/${inspection._id}/edit`);
      expect(res.status).toBe(404);
    });
  });

  describe("Update Inspection", () => {
    it("updates inspection fields", async () => {
      const a = agent();
      const admin = await createAdminUser();
      
      const inspection = await Inspection.create({
        user: admin._id,
        code: "UPDATE",
        vrm: "UPDATEVRM",
        mileage: 50000,
        notes: "Original notes"
      });

      await a.post("/login").type("form").send({ 
        email: "admin@example.com", 
        password: "password123" 
      });

      const res = await a.post(`/inspections/${inspection._id}/update`)
        .type("form")
        .send({
          mileage: 55000,
          notes: "Updated notes"
        });
      
      expect(res.status).toBe(302);
              expect(res.headers.location).toMatch(/\/inspections\?code=UPDATE/);

      const updated = await Inspection.findById(inspection._id).lean();
      expect(updated.mileage).toBe(55000);
      expect(updated.notes).toBe("Updated notes");
    });

    it("handles invalid mileage values", async () => {
      const a = agent();
      const admin = await createAdminUser();
      
      const inspection = await Inspection.create({
        user: admin._id,
        code: "INVAL1",
        vrm: "INVALID",
        mileage: 50000
      });

      await a.post("/login").type("form").send({ 
        email: "admin@example.com", 
        password: "password123" 
      });

      const res = await a.post(`/inspections/${inspection._id}/update`)
        .type("form")
        .send({
          mileage: "invalid",
          notes: "Test notes"
        });
      
      expect(res.status).toBe(302);

      const updated = await Inspection.findById(inspection._id).lean();
      expect(updated.mileage).toBe(50000); // Should remain unchanged
      expect(updated.notes).toBe("Test notes");
    });
  });

  describe("Delete Inspection", () => {
    it("deletes admin's own inspection", async () => {
      const a = agent();
      const admin = await createAdminUser();
      
      const inspection = await Inspection.create({
        user: admin._id,
        code: "DELETE",
        vrm: "DELETEVRM",
        mileage: 50000
      });

      await a.post("/login").type("form").send({ 
        email: "admin@example.com", 
        password: "password123" 
      });

      const res = await a.delete(`/inspections/${inspection._id}`);
      expect(res.status).toBe(200);

      const deleted = await Inspection.findById(inspection._id);
      expect(deleted).toBeNull();
    });

    it("prevents non-admin users from deleting", async () => {
      const a = agent();
      const admin = await createAdminUser();
      
      // Create technician
      await a.post("/login").type("form").send({ 
        email: "admin@example.com", 
        password: "password123" 
      });
      
      await a.post("/technicians").type("form").send({
        name: "Tech User",
        email: "tech@example.com",
        password: "techpass123",
        dailyLimit: "5"
      });
      
      const tech = await User.findOne({ email: "tech@example.com" });
      
      const inspection = await Inspection.create({
        user: tech._id,
        code: "TECHD1",
        vrm: "TECHDEL",
        mileage: 50000
      });

      // Login as technician
      await a.post("/login").type("form").send({ 
        email: "tech@example.com", 
        password: "techpass123" 
      });

      const res = await a.delete(`/inspections/${inspection._id}`);
      expect(res.status).toBe(403);
      expect(res.text).toMatch(/Admins only/);

      const notDeleted = await Inspection.findById(inspection._id);
      expect(notDeleted).toBeTruthy();
    });

    it("prevents deleting other user's inspection", async () => {
      const a = agent();
      const admin1 = await createAdminUser("admin1@example.com");
      const admin2 = await createAdminUser("admin2@example.com");
      
      const inspection = await Inspection.create({
        user: admin1._id,
        code: "OTHERD",
        vrm: "OTHERDEL",
        mileage: 50000
      });

      await a.post("/login").type("form").send({ 
        email: "admin2@example.com", 
        password: "password123" 
      });

      const res = await a.delete(`/inspections/${inspection._id}`);
      expect(res.status).toBe(403);
      expect(res.text).toMatch(/Not your inspection/);

      const notDeleted = await Inspection.findById(inspection._id);
      expect(notDeleted).toBeTruthy();
    });
  });

  describe("Usage Event Logging", () => {
    it("logs VRM usage when creating inspection", async () => {
      const a = agent();
      const admin = await createAdminUser();
      await createTestVehicle();
      
      await a.post("/login").type("form").send({ 
        email: "admin@example.com", 
        password: "password123" 
      });

      const payload = {
        vrm: "AB12CDE",
        "offside.front.size": "225/45R17",
        "offside.rear.size": "225/45R17",
        "nearside.front.size": "225/45R17",
        "nearside.rear.size": "225/45R17"
      };

      await a.post("/inspections").type("form").send(payload);

      const usageEvents = await UsageEvent.find({ 
        user: admin._id, 
        type: "vrm_lookup",
        "meta.vrm": "AB12CDE"
      });
      
      expect(usageEvents.length).toBeGreaterThan(0);
      expect(usageEvents[0].meta.reason).toBe("implicit_from_inspection");
    });

    it("does not duplicate VRM usage for same day", async () => {
      const a = agent();
      const admin = await createAdminUser();
      await createTestVehicle();
      
      await a.post("/login").type("form").send({ 
        email: "admin@example.com", 
        password: "password123" 
      });

      const payload = {
        vrm: "AB12CDE",
        "offside.front.size": "225/45R17",
        "offside.rear.size": "225/45R17",
        "nearside.front.size": "225/45R17",
        "nearside.rear.size": "225/45R17"
      };

      // Create two inspections with same VRM
      await a.post("/inspections").type("form").send(payload);
      await a.post("/inspections").type("form").send(payload);

      const usageEvents = await UsageEvent.find({ 
        user: admin._id, 
        type: "vrm_lookup",
        "meta.vrm": "AB12CDE"
      });
      
      // Should only have one usage event for the day
      expect(usageEvents.length).toBe(1);
    });
  });
});
