// tests/vrm.comprehensive.spec.js
import { agent } from "./utils/testAgent.js";
import { vi } from "vitest";
import Vehicle from "../models/vehicle.model.js";
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

async function createTechnician(adminId, email = "tech@example.com") {
  const a = agent();
  await a.post("/login").type("form").send({ 
    email: "admin@example.com", 
    password: "password123" 
  });
  
  await a.post("/technicians").type("form").send({
    name: "Tech User",
    email,
    password: "techpass123",
    dailyLimit: "5"
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

describe("VRM Lookup Comprehensive Tests", () => {
  describe("VRM Lookup Success", () => {
    it("finds existing vehicle in database", async () => {
      const a = agent();
      const admin = await createAdminUser();
      const vehicle = await createTestVehicle();
      
      await a.post("/login").type("form").send({ 
        email: "admin@example.com", 
        password: "password123" 
      });

      const res = await a.post("/vrm")
        .type("form")
        .send({ vrm: "AB12CDE", mileage: "50000" });
      
      expect(res.status).toBe(200);
      expect(res.text).toMatch(/Test Make/);
      expect(res.text).toMatch(/Test Model/);
      expect(res.text).toMatch(/225\/45R17/);
      expect(res.text).toMatch(/32/);
      expect(res.text).toMatch(/34/);
    });

    it("looks up new VRM via external service", async () => {
      const a = agent();
      const admin = await createAdminUser();
      
      await a.post("/login").type("form").send({ 
        email: "admin@example.com", 
        password: "password123" 
      });

      const res = await a.post("/vrm")
        .type("form")
        .send({ vrm: "NEW123", mileage: "60000" });
      
      expect(res.status).toBe(200);
      expect(res.text).toMatch(/TestMake/);
      expect(res.text).toMatch(/TestModel/);
      
      // Should save to database
      const savedVehicle = await Vehicle.findOne({ vrm: "NEW123" });
      expect(savedVehicle).toBeTruthy();
    });

    it("normalizes VRM input", async () => {
      const a = agent();
      const admin = await createAdminUser();
      const vehicle = await createTestVehicle("AB12CDE");
      
      await a.post("/login").type("form").send({ 
        email: "admin@example.com", 
        password: "password123" 
      });

      // Test various VRM formats
      const testCases = [
        "ab12cde",
        "AB 12 CDE",
        "AB12 CDE",
        "AB12CDE",
        " ab12cde "
      ];

      for (const testVrm of testCases) {
        const res = await a.post("/vrm")
          .type("form")
          .send({ vrm: testVrm, mileage: "50000" });
        
        expect(res.status).toBe(200);
        expect(res.text).toMatch(/Test Make/);
      }
    });

    it("handles mileage prefill", async () => {
      const a = agent();
      const admin = await createAdminUser();
      const vehicle = await createTestVehicle();
      
      await a.post("/login").type("form").send({ 
        email: "admin@example.com", 
        password: "password123" 
      });

      const res = await a.post("/vrm")
        .type("form")
        .send({ vrm: "AB12CDE", mileage: "75000" });
      
      expect(res.status).toBe(200);
      expect(res.text).toMatch(/75000/);
    });

    it("handles empty mileage", async () => {
      const a = agent();
      const admin = await createAdminUser();
      const vehicle = await createTestVehicle();
      
      await a.post("/login").type("form").send({ 
        email: "admin@example.com", 
        password: "password123" 
      });

      const res = await a.post("/vrm")
        .type("form")
        .send({ vrm: "AB12CDE" });
      
      expect(res.status).toBe(200);
      expect(res.text).toMatch(/Test Make/);
    });
  });

  describe("VRM Lookup Errors", () => {
    it("handles VRM not found", async () => {
      const a = agent();
      const admin = await createAdminUser();
      
      await a.post("/login").type("form").send({ 
        email: "admin@example.com", 
        password: "password123" 
      });

      const res = await a.post("/vrm")
        .type("form")
        .send({ vrm: "NOTFOUND", mileage: "50000" });
      
      expect(res.status).toBe(200);
      expect(res.text).toMatch(/Couldn.*t find tyre data/);
      expect(res.text).toMatch(/NOTFOUND/);
    });

    it("handles vehicle with no tyre records", async () => {
      const a = agent();
      const admin = await createAdminUser();
      
      // Create vehicle without tyre records
      await Vehicle.create({
        vrm: "NORECORDS",
        make: "Test Make",
        model: "Test Model",
        year: "2020",
        tyreRecords: []
      });
      
      await a.post("/login").type("form").send({ 
        email: "admin@example.com", 
        password: "password123" 
      });

      const res = await a.post("/vrm")
        .type("form")
        .send({ vrm: "NORECORDS", mileage: "50000" });
      
      expect(res.status).toBe(200);
      expect(res.text).toMatch(/No tyre records available/);
      expect(res.text).toMatch(/NORECORDS/);
    });

    it("handles empty VRM input", async () => {
      const a = agent();
      const admin = await createAdminUser();
      
      await a.post("/login").type("form").send({ 
        email: "admin@example.com", 
        password: "password123" 
      });

      const res = await a.post("/vrm")
        .type("form")
        .send({ vrm: "", mileage: "50000" });
      
      expect(res.status).toBe(200);
      expect(res.text).toMatch(/Couldn.*t find tyre data/);
    });

    it("handles whitespace-only VRM", async () => {
      const a = agent();
      const admin = await createAdminUser();
      
      await a.post("/login").type("form").send({ 
        email: "admin@example.com", 
        password: "password123" 
      });

      const res = await a.post("/vrm")
        .type("form")
        .send({ vrm: "   ", mileage: "50000" });
      
      expect(res.status).toBe(200);
      expect(res.text).toMatch(/Couldn.*t find tyre data/);
    });
  });

  describe("Daily Limit Enforcement", () => {
    it("enforces admin daily limit", async () => {
      const a = agent();
      const admin = await createAdminUser();
      
      // Set low daily limit
      await User.updateOne({ _id: admin._id }, { dailyLimit: 2 });
      
      await a.post("/login").type("form").send({ 
        email: "admin@example.com", 
        password: "password123" 
      });

      // First lookup should work
      const res1 = await a.post("/vrm")
        .type("form")
        .send({ vrm: "TEST1", mileage: "50000" });
      expect(res1.status).toBe(200);

      // Second lookup should work
      const res2 = await a.post("/vrm")
        .type("form")
        .send({ vrm: "TEST2", mileage: "50000" });
      expect(res2.status).toBe(200);

      // Third lookup should be blocked
      const res3 = await a.post("/vrm")
        .type("form")
        .send({ vrm: "TEST3", mileage: "50000" });
      expect(res3.status).toBe(429);
      expect(res3.text).toMatch(/Account daily limit reached/);
    });

    it("enforces technician daily limit", async () => {
      const a = agent();
      const admin = await createAdminUser();
      const tech = await createTechnician(admin._id);
      
      // Set low daily limit for technician
      await User.updateOne({ _id: tech._id }, { dailyLimit: 1 });
      
      // Login as technician
      await a.post("/login").type("form").send({ 
        email: "tech@example.com", 
        password: "techpass123" 
      });

      // First lookup should work
      const res1 = await a.post("/vrm")
        .type("form")
        .send({ vrm: "TEST1", mileage: "50000" });
      expect(res1.status).toBe(200);

      // Second lookup should be blocked
      const res2 = await a.post("/vrm")
        .type("form")
        .send({ vrm: "TEST2", mileage: "50000" });
      expect(res2.status).toBe(429);
      expect(res2.text).toMatch(/Technician daily limit reached/);
    });

    it("allows unlimited usage when daily limit is 0", async () => {
      const a = agent();
      const admin = await createAdminUser();
      
      // Set unlimited daily limit
      await User.updateOne({ _id: admin._id }, { dailyLimit: 0 });
      
      await a.post("/login").type("form").send({ 
        email: "admin@example.com", 
        password: "password123" 
      });

      // Multiple lookups should work
      for (let i = 1; i <= 5; i++) {
        const res = await a.post("/vrm")
          .type("form")
          .send({ vrm: `TEST${i}`, mileage: "50000" });
        expect(res.status).toBe(200);
      }
    });

    it("blocks inactive technicians", async () => {
      const a = agent();
      const admin = await createAdminUser();
      const tech = await createTechnician(admin._id);
      
      // Deactivate technician
      await User.updateOne({ _id: tech._id }, { active: false });
      
      // Login as technician should fail
      const loginRes = await a.post("/login").type("form").send({ 
        email: "tech@example.com", 
        password: "techpass123" 
      });
      
      expect(loginRes.status).toBe(401);
      expect(loginRes.text).toMatch(/Incorrect credentials/);
    });

    it("enforces admin pool limit for technicians", async () => {
      const a = agent();
      const admin = await createAdminUser();
      const tech = await createTechnician(admin._id);
      
      // Set low admin pool limit
      await User.updateOne({ _id: admin._id }, { dailyLimit: 2 });
      await User.updateOne({ _id: tech._id }, { dailyLimit: 5 }); // Tech wants more than pool allows
      
      // Login as technician
      await a.post("/login").type("form").send({ 
        email: "tech@example.com", 
        password: "techpass123" 
      });

      // First lookup should work
      const res1 = await a.post("/vrm")
        .type("form")
        .send({ vrm: "TEST1", mileage: "50000" });
      expect(res1.status).toBe(200);

      // Second lookup should work
      const res2 = await a.post("/vrm")
        .type("form")
        .send({ vrm: "TEST2", mileage: "50000" });
      expect(res2.status).toBe(200);

      // Third lookup should be blocked (admin pool exhausted)
      const res3 = await a.post("/vrm")
        .type("form")
        .send({ vrm: "TEST3", mileage: "50000" });
      expect(res3.status).toBe(429);
      expect(res3.text).toMatch(/Account daily limit reached/);
    });
  });

  describe("Usage Event Logging", () => {
    it("logs VRM lookup usage for admin", async () => {
      const a = agent();
      const admin = await createAdminUser();
      
      await a.post("/login").type("form").send({ 
        email: "admin@example.com", 
        password: "password123" 
      });

      await a.post("/vrm")
        .type("form")
        .send({ vrm: "LOGGED1", mileage: "50000" });

      const usageEvents = await UsageEvent.find({ 
        user: admin._id, 
        type: "vrm_lookup",
        "meta.vrm": "LOGGED1"
      });
      
      expect(usageEvents.length).toBe(1);
      expect(usageEvents[0].meta.reason).toBe("explicit_lookup");
      expect(usageEvents[0].billedTo).toEqual(admin._id);
    });

    it("logs VRM lookup usage for technician with correct billing", async () => {
      const a = agent();
      const admin = await createAdminUser();
      const tech = await createTechnician(admin._id);
      
      // Login as technician
      await a.post("/login").type("form").send({ 
        email: "tech@example.com", 
        password: "techpass123" 
      });

      await a.post("/vrm")
        .type("form")
        .send({ vrm: "LOGGED2", mileage: "50000" });

      const usageEvents = await UsageEvent.find({ 
        user: tech._id, 
        type: "vrm_lookup",
        "meta.vrm": "LOGGED2"
      });
      
      expect(usageEvents.length).toBe(1);
      expect(usageEvents[0].meta.reason).toBe("explicit_lookup");
      expect(usageEvents[0].billedTo).toEqual(admin._id); // Should bill to admin
    });

    it("counts usage correctly for daily limits", async () => {
      const a = agent();
      const admin = await createAdminUser();
      
      await a.post("/login").type("form").send({ 
        email: "admin@example.com", 
        password: "password123" 
      });

      // Create usage events for today
      await UsageEvent.create([
        {
          user: admin._id,
          billedTo: admin._id,
          type: "vrm_lookup",
          meta: { vrm: "COUNT1" }
        },
        {
          user: admin._id,
          billedTo: admin._id,
          type: "vrm_lookup",
          meta: { vrm: "COUNT2" }
        }
      ]);

      // Set daily limit to 3
      await User.updateOne({ _id: admin._id }, { dailyLimit: 3 });

      // Third lookup should work
      const res = await a.post("/vrm")
        .type("form")
        .send({ vrm: "COUNT3", mileage: "50000" });
      expect(res.status).toBe(200);

      // Fourth lookup should be blocked
      const res2 = await a.post("/vrm")
        .type("form")
        .send({ vrm: "COUNT4", mileage: "50000" });
      expect(res2.status).toBe(429);
    });
  });

  describe("Authentication Requirements", () => {
    it("requires authentication for VRM lookup", async () => {
      const a = agent();
      const res = await a.post("/vrm")
        .type("form")
        .send({ vrm: "TEST1", mileage: "50000" });
      
      expect(res.status).toBe(401);
      expect(res.text).toMatch(/Login required/);
    });
  });

  describe("Recent Lookup Grace Period", () => {
    it("allows completing inspection flow after recent lookup", async () => {
      const a = agent();
      const admin = await createAdminUser();
      const vehicle = await createTestVehicle();
      
      await a.post("/login").type("form").send({ 
        email: "admin@example.com", 
        password: "password123" 
      });

      // Set low daily limit
      await User.updateOne({ _id: admin._id }, { dailyLimit: 1 });

      // First lookup (consumes limit)
      const res1 = await a.post("/vrm")
        .type("form")
        .send({ vrm: "AB12CDE", mileage: "50000" });
      expect(res1.status).toBe(200);

      // Second lookup should be blocked normally
      const res2 = await a.post("/vrm")
        .type("form")
        .send({ vrm: "DIFFERENT", mileage: "50000" });
      expect(res2.status).toBe(429);

      // But same VRM should work (grace period for completing inspection)
      const res3 = await a.post("/vrm")
        .type("form")
        .send({ vrm: "AB12CDE", mileage: "50000" });
      expect(res3.status).toBe(200);
    });
  });
});
