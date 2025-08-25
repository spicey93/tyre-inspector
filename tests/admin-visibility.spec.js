import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import User from "../models/user.model.js";
import Inspection from "../models/inspection.model.js";
import { agent } from "./utils/testAgent.js";

let mongo;

async function createAdminUser(email = "admin@example.com") {
  const admin = new User({
    name: "Admin User",
    email,
    role: "admin",
    dailyLimit: 20
  });
  await admin.setPassword("password123");
  return await admin.save();
}

async function createTechnicianUser(adminId, email = "tech@example.com") {
  const tech = new User({
    name: "Tech User",
    email,
    role: "technician",
    owner: adminId,
    dailyLimit: 5,
    active: true
  });
  await tech.setPassword("techpass123");
  return await tech.save();
}

describe("Admin Visibility and Technician Permissions", () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    const uri = mongo.getUri();
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(uri);
    }
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase().catch(() => {});
    await mongoose.disconnect().catch(() => {});
    if (mongo) await mongo.stop();
  });

  describe("Admin Visibility of Technician Inspections", () => {
    it("admin can see inspections created by their technicians", async () => {
      const a = agent();
      
      // Create admin
      const admin = await createAdminUser();
      
      // Create technician owned by admin
      const technician = await createTechnicianUser(admin._id);
      
      // Create inspection as technician
      const inspection = await Inspection.create({
        user: technician._id,
        createdBy: technician._id,
        code: "TECH01",
        vrm: "TECHVRM",
        mileage: 50000,
        notes: "Technician inspection",
        offside: { front: {}, rear: {} },
        nearside: { front: {}, rear: {} },
      });
      
      // Login as admin
      await a.post("/login").type("form").send({ 
        email: "admin@example.com", 
        password: "password123" 
      });
      
      // Admin should be able to see the technician's inspection
      const res = await a.get("/inspections");
      expect(res.status).toBe(200);
      expect(res.text).toContain("TECH01");
      expect(res.text).toContain("TECHVRM");
    });

    it("admin can see both their own and technician inspections", async () => {
      const a = agent();
      
      // Create admin
      const admin = await createAdminUser("admin2@example.com");
      
      // Create technician owned by admin
      const technician = await createTechnicianUser(admin._id, "tech2@example.com");
      
      // Create admin's own inspection
      const adminInspection = await Inspection.create({
        user: admin._id,
        createdBy: admin._id,
        code: "ADMIN1",
        vrm: "ADMINVRM",
        mileage: 40000,
        notes: "Admin inspection",
        offside: { front: {}, rear: {} },
        nearside: { front: {}, rear: {} },
      });
      
      // Create technician's inspection
      const techInspection = await Inspection.create({
        user: technician._id,
        createdBy: technician._id,
        code: "TECH02",
        vrm: "TECH2VRM",
        mileage: 50000,
        notes: "Technician inspection",
        offside: { front: {}, rear: {} },
        nearside: { front: {}, rear: {} },
      });
      
      // Login as admin
      await a.post("/login").type("form").send({ 
        email: "admin2@example.com", 
        password: "password123" 
      });
      
      // Admin should see both inspections
      const res = await a.get("/inspections");
      expect(res.status).toBe(200);
      expect(res.text).toContain("ADMIN1");
      expect(res.text).toContain("ADMINVRM");
      expect(res.text).toContain("TECH02");
      expect(res.text).toContain("TECH2VRM");
    });

    it("technician cannot see other technicians' inspections", async () => {
      const a = agent();
      
      // Create admin
      const admin = await createAdminUser("admin3@example.com");
      
      // Create two technicians
      const tech1 = await createTechnicianUser(admin._id, "tech1@example.com");
      const tech2 = await createTechnicianUser(admin._id, "tech2@example.com");
      
      // Create inspection as tech1
      const inspection = await Inspection.create({
        user: tech1._id,
        createdBy: tech1._id,
        code: "TECH03",
        vrm: "TECH3VRM",
        mileage: 60000,
        notes: "Tech1 inspection",
        offside: { front: {}, rear: {} },
        nearside: { front: {}, rear: {} },
      });
      
      // Login as tech2
      await a.post("/login").type("form").send({ 
        email: "tech2@example.com", 
        password: "techpass123" 
      });
      
      // Tech2 should not see tech1's inspection
      const res = await a.get("/inspections");
      expect(res.status).toBe(200);
      expect(res.text).not.toContain("TECH03");
      expect(res.text).not.toContain("TECH3VRM");
    });

    it("admin cannot see technicians from other admins", async () => {
      const a = agent();
      
      // Create two admins
      const admin1 = await createAdminUser("admin4@example.com");
      const admin2 = await createAdminUser("admin5@example.com");
      
      // Create technician for admin1
      const tech1 = await createTechnicianUser(admin1._id, "tech4@example.com");
      
      // Create inspection as tech1
      const inspection = await Inspection.create({
        user: tech1._id,
        createdBy: tech1._id,
        code: "TECH04",
        vrm: "TECH4VRM",
        mileage: 70000,
        notes: "Tech4 inspection",
        offside: { front: {}, rear: {} },
        nearside: { front: {}, rear: {} },
      });
      
      // Login as admin2
      await a.post("/login").type("form").send({ 
        email: "admin5@example.com", 
        password: "password123" 
      });
      
      // Admin2 should not see tech1's inspection
      const res = await a.get("/inspections");
      expect(res.status).toBe(200);
      expect(res.text).not.toContain("TECH04");
      expect(res.text).not.toContain("TECH4VRM");
    });
  });

  describe("Delete Button UI Visibility", () => {
    it("technician cannot see delete buttons", async () => {
      const a = agent();
      
      // Create admin and technician
      const admin = await createAdminUser("admin6@example.com");
      const technician = await createTechnicianUser(admin._id, "tech5@example.com");
      
      // Create inspection as technician
      const inspection = await Inspection.create({
        user: technician._id,
        createdBy: technician._id,
        code: "TECH05",
        vrm: "TECH5VRM",
        mileage: 80000,
        notes: "Tech5 inspection",
        offside: { front: {}, rear: {} },
        nearside: { front: {}, rear: {} },
      });
      
      // Login as technician
      await a.post("/login").type("form").send({ 
        email: "tech5@example.com", 
        password: "techpass123" 
      });
      
      // Technician should not see delete buttons
      const res = await a.get("/inspections");
      expect(res.status).toBe(200);
      expect(res.text).not.toContain("Delete");
      expect(res.text).not.toContain("hx-delete");
    });

    it("admin can see delete buttons for their own inspections", async () => {
      const a = agent();
      
      // Create admin
      const admin = await createAdminUser("admin7@example.com");
      
      // Create inspection as admin
      const inspection = await Inspection.create({
        user: admin._id,
        createdBy: admin._id,
        code: "ADMIN2",
        vrm: "ADMIN2VRM",
        mileage: 90000,
        notes: "Admin2 inspection",
        offside: { front: {}, rear: {} },
        nearside: { front: {}, rear: {} },
      });
      
      // Login as admin
      await a.post("/login").type("form").send({ 
        email: "admin7@example.com", 
        password: "password123" 
      });
      
      // Admin should see delete buttons
      const res = await a.get("/inspections");
      expect(res.status).toBe(200);
      expect(res.text).toContain("Delete");
      expect(res.text).toContain("hx-delete");
      expect(res.text).toContain("ADMIN2");
    });

    it("admin can see delete buttons for technician inspections", async () => {
      const a = agent();
      
      // Create admin and technician
      const admin = await createAdminUser("admin8@example.com");
      const technician = await createTechnicianUser(admin._id, "tech6@example.com");
      
      // Create inspection as technician
      const inspection = await Inspection.create({
        user: technician._id,
        createdBy: technician._id,
        code: "TECH06",
        vrm: "TECH6VRM",
        mileage: 100000,
        notes: "Tech6 inspection",
        offside: { front: {}, rear: {} },
        nearside: { front: {}, rear: {} },
      });
      
      // Login as admin
      await a.post("/login").type("form").send({ 
        email: "admin8@example.com", 
        password: "password123" 
      });
      
      // Admin should see delete buttons for technician's inspection
      const res = await a.get("/inspections");
      expect(res.status).toBe(200);
      expect(res.text).toContain("Delete");
      expect(res.text).toContain("hx-delete");
      expect(res.text).toContain("TECH06");
    });
  });

  describe("Inactive Technicians", () => {
    it("admin cannot see inspections from inactive technicians", async () => {
      const a = agent();
      
      // Create admin
      const admin = await createAdminUser("admin9@example.com");
      
      // Create inactive technician
      const technician = new User({
        name: "Inactive Tech",
        email: "inactive@example.com",
        role: "technician",
        owner: admin._id,
        dailyLimit: 5,
        active: false // Inactive technician
      });
      await technician.setPassword("techpass123");
      await technician.save();
      
      // Create inspection as inactive technician
      const inspection = await Inspection.create({
        user: technician._id,
        createdBy: technician._id,
        code: "INACT1",
        vrm: "INACTVRM",
        mileage: 110000,
        notes: "Inactive tech inspection",
        offside: { front: {}, rear: {} },
        nearside: { front: {}, rear: {} },
      });
      
      // Login as admin
      await a.post("/login").type("form").send({ 
        email: "admin9@example.com", 
        password: "password123" 
      });
      
      // Admin should not see inactive technician's inspection
      const res = await a.get("/inspections");
      expect(res.status).toBe(200);
      expect(res.text).not.toContain("INACT1");
      expect(res.text).not.toContain("INACTVRM");
    });
  });
});
