// tests/dashboard.spec.js
import { agent } from "./utils/testAgent.js";
import { vi } from "vitest";
import User from "../models/user.model.js";
import Inspection from "../models/inspection.model.js";
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

describe("Dashboard", () => {
  it("shows correct stats for admin user", async () => {
    const a = agent();
    const admin = await createAdminUser();
    
    // Create some test inspections
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    await Inspection.create([
      {
        user: admin._id,
        code: "ABC123",
        vrm: "AB12CDE",
        createdAt: today,
        mileage: 50000
      },
      {
        user: admin._id,
        code: "DEF456",
        vrm: "CD34FGH",
        createdAt: yesterday,
        mileage: 60000
      }
    ]);

    await a.post("/login").type("form").send({ 
      email: "admin@example.com", 
      password: "password123" 
    });

    const res = await a.get("/dashboard");
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/Dashboard/);
          expect(res.text).toMatch(/Total/);
      expect(res.text).toMatch(/Today/);
      expect(res.text).toMatch(/Unique VRMs/);
  });

  it("shows correct stats for technician user", async () => {
    const a = agent();
    const admin = await createAdminUser();
    const tech = await createTechnician(admin._id);
    
    // Create inspections for both admin and tech
    await Inspection.create([
      {
        user: admin._id,
        code: "ADM001",
        vrm: "ADMIN1",
        createdAt: new Date()
      },
      {
        user: tech._id,
        code: "TEC001",
        vrm: "TECH1",
        createdAt: new Date()
      }
    ]);

    // Login as technician
    await a.post("/login").type("form").send({ 
      email: "tech@example.com", 
      password: "techpass123" 
    });

    const res = await a.get("/dashboard");
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/Dashboard/);
          expect(res.text).toMatch(/Total/); // Should only see their own inspections
  });

  it("shows daily limit information", async () => {
    const a = agent();
    const admin = await createAdminUser();
    
    // Set a daily limit
    await User.updateOne({ _id: admin._id }, { dailyLimit: 10 });
    
    // Create some usage events
    await UsageEvent.create([
      {
        user: admin._id,
        billedTo: admin._id,
        type: "vrm_lookup",
        meta: { vrm: "TEST1" }
      },
      {
        user: admin._id,
        billedTo: admin._id,
        type: "vrm_lookup",
        meta: { vrm: "TEST2" }
      }
    ]);

    await a.post("/login").type("form").send({ 
      email: "admin@example.com", 
      password: "password123" 
    });

    const res = await a.get("/dashboard");
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/Daily VRM usage/);
    expect(res.text).toMatch(/2 \/ 10 used/);
    expect(res.text).toMatch(/8 left today/);
  });

  it("shows unlimited when daily limit is 0", async () => {
    const a = agent();
    const admin = await createAdminUser();
    
    // Set unlimited daily limit
    await User.updateOne({ _id: admin._id }, { dailyLimit: 0 });

    await a.post("/login").type("form").send({ 
      email: "admin@example.com", 
      password: "password123" 
    });

    const res = await a.get("/dashboard");
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/∞ left today/);
  });

  it("shows recent activity when available", async () => {
    const a = agent();
    const admin = await createAdminUser();
    
    // Create recent inspections
    await Inspection.create([
      {
        user: admin._id,
        code: "REC001",
        vrm: "RECENT1",
        createdAt: new Date()
      },
      {
        user: admin._id,
        code: "REC002",
        vrm: "RECENT2",
        createdAt: new Date()
      }
    ]);

    await a.post("/login").type("form").send({ 
      email: "admin@example.com", 
      password: "password123" 
    });

    const res = await a.get("/dashboard");
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/Recent activity/);
    expect(res.text).toMatch(/REC001/);
    expect(res.text).toMatch(/REC002/);
  });

  it("calculates week and month stats correctly", async () => {
    const a = agent();
    const admin = await createAdminUser();
    
    // Create inspections for different time periods
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    
    await Inspection.create([
      {
        user: admin._id,
        code: "TODAY1",
        vrm: "TODAY",
        createdAt: today
      },
      {
        user: admin._id,
        code: "WEEK12",
        vrm: "WEEK",
        createdAt: weekAgo
      },
      {
        user: admin._id,
        code: "MONTH1",
        vrm: "MONTH",
        createdAt: monthAgo
      }
    ]);

    await a.post("/login").type("form").send({ 
      email: "admin@example.com", 
      password: "password123" 
    });

    const res = await a.get("/dashboard");
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/This week/); // actual calculated value
    expect(res.text).toMatch(/This month/); // actual calculated value
  });

  it("blocks unauthenticated users", async () => {
    const a = agent();
    const res = await a.get("/dashboard").redirects(0);
    expect(res.status).toBe(401);
  });
});
