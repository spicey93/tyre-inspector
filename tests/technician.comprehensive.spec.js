// tests/technician.comprehensive.spec.js
import { agent } from "./utils/testAgent.js";
import { vi } from "vitest";
import User from "../models/user.model.js";

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

describe("Technician Management Comprehensive Tests", () => {
  describe("List Technicians", () => {
    it("lists technicians for admin", async () => {
      const a = agent();
      const admin = await createAdminUser();
      
      await a.post("/login").type("form").send({ 
        email: "admin@example.com", 
        password: "password123" 
      });

      const res = await a.get("/technicians");
      expect(res.status).toBe(200);
      expect(res.text).toMatch(/Technicians/);
      expect(res.text).toMatch(/Remaining:/);
    });

    it("shows correct remaining count", async () => {
      const a = agent();
      const admin = await createAdminUser();
      
      await a.post("/login").type("form").send({ 
        email: "admin@example.com", 
        password: "password123" 
      });

      // Create one technician
      await a.post("/technicians").type("form").send({
        name: "Tech One",
        email: "tech1@example.com",
        password: "techpass123",
        dailyLimit: "5"
      });

      const res = await a.get("/technicians");
      expect(res.status).toBe(200);
      expect(res.text).toMatch(/Remaining:/);
      expect(res.text).toMatch(/Tech One/);
      expect(res.text).toMatch(/tech1@example.com/);
    });

    it("prevents non-admin access", async () => {
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

      // Login as technician
      await a.post("/login").type("form").send({ 
        email: "tech@example.com", 
        password: "techpass123" 
      });

      const res = await a.get("/technicians");
      expect(res.status).toBe(403);
    });

    it("prevents unauthenticated access", async () => {
      const a = agent();
      const res = await a.get("/technicians").redirects(0);
      expect(res.status).toBe(401);
    });
  });

  describe("Create Technician", () => {
    it("creates technician successfully", async () => {
      const a = agent();
      const admin = await createAdminUser();
      
      await a.post("/login").type("form").send({ 
        email: "admin@example.com", 
        password: "password123" 
      });

      const res = await a.post("/technicians").type("form").send({
        name: "New Tech",
        email: "newtech@example.com",
        password: "newpass123",
        dailyLimit: "10"
      }).redirects(0);

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("/technicians");

      const tech = await User.findOne({ email: "newtech@example.com" }).lean();
      expect(tech).toBeTruthy();
      expect(tech.role).toBe("technician");
      expect(tech.owner).toEqual(admin._id);
      expect(tech.dailyLimit).toBe(3);
      expect(tech.active).toBe(true);
    });

    it("enforces maximum technician limit", async () => {
      const a = agent();
      const admin = await createAdminUser();
      
      await a.post("/login").type("form").send({ 
        email: "admin@example.com", 
        password: "password123" 
      });

      // Create maximum technicians (2)
      await a.post("/technicians").type("form").send({
        name: "Tech One",
        email: "tech1@example.com",
        password: "techpass123",
        dailyLimit: "5"
      });

      await a.post("/technicians").type("form").send({
        name: "Tech Two",
        email: "tech2@example.com",
        password: "techpass123",
        dailyLimit: "5"
      });

      // Try to create third technician
      const res = await a.post("/technicians").type("form").send({
        name: "Tech Three",
        email: "tech3@example.com",
        password: "techpass123",
        dailyLimit: "5"
      }).redirects(0);

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("/technicians");

      const techs = await User.find({ role: "technician", owner: admin._id }).lean();
      expect(techs.length).toBe(2);
    });

    it("prevents duplicate email addresses", async () => {
      const a = agent();
      const admin = await createAdminUser();
      
      await a.post("/login").type("form").send({ 
        email: "admin@example.com", 
        password: "password123" 
      });

      // Create first technician
      await a.post("/technicians").type("form").send({
        name: "Tech One",
        email: "duplicate@example.com",
        password: "techpass123",
        dailyLimit: "5"
      });

      // Try to create second with same email
      const res = await a.post("/technicians").type("form").send({
        name: "Tech Two",
        email: "duplicate@example.com",
        password: "techpass123",
        dailyLimit: "5"
      }).redirects(0);

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("/technicians");

      const techs = await User.find({ email: "duplicate@example.com" }).lean();
      expect(techs.length).toBe(1);
    });

    it("prevents duplicate email with existing admin", async () => {
      const a = agent();
      const admin = await createAdminUser();
      
      // Create another admin with different email
      const a2 = agent();
      await a2.post("/register").type("form").send({ 
        name: "Admin Two", 
        email: "admin2@example.com", 
        password: "password123" 
      });

      await a.post("/login").type("form").send({ 
        email: "admin@example.com", 
        password: "password123" 
      });

      // Try to create technician with admin2's email
      const res = await a.post("/technicians").type("form").send({
        name: "Tech One",
        email: "admin2@example.com",
        password: "techpass123",
        dailyLimit: "5"
      }).redirects(0);

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("/technicians");

      const techs = await User.find({ role: "technician", owner: admin._id }).lean();
      expect(techs.length).toBe(0);
    });

    it("requires email and password", async () => {
      const a = agent();
      const admin = await createAdminUser();
      
      await a.post("/login").type("form").send({ 
        email: "admin@example.com", 
        password: "password123" 
      });

      // Missing email
      const res1 = await a.post("/technicians").type("form").send({
        name: "Tech One",
        password: "techpass123",
        dailyLimit: "5"
      }).redirects(0);

      expect(res1.status).toBe(302);
      expect(res1.headers.location).toBe("/technicians");

      // Missing password
      const res2 = await a.post("/technicians").type("form").send({
        name: "Tech Two",
        email: "tech2@example.com",
        dailyLimit: "5"
      }).redirects(0);

      expect(res2.status).toBe(302);
      expect(res2.headers.location).toBe("/technicians");

      const techs = await User.find({ role: "technician", owner: admin._id }).lean();
      expect(techs.length).toBe(0);
    });

    it("caps daily limit based on admin pool", async () => {
      const a = agent();
      const admin = await createAdminUser();
      
      // Set low admin daily limit
      await User.updateOne({ _id: admin._id }, { dailyLimit: 5 });
      
      await a.post("/login").type("form").send({ 
        email: "admin@example.com", 
        password: "password123" 
      });

      // Try to create technician with higher limit than admin pool
      const res = await a.post("/technicians").type("form").send({
        name: "Tech One",
        email: "tech1@example.com",
        password: "techpass123",
        dailyLimit: "10"
      }).redirects(0);

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("/technicians");

      const tech = await User.findOne({ email: "tech1@example.com" }).lean();
      expect(tech.dailyLimit).toBe(5); // Should be capped to admin pool
    });

    it("allows unlimited daily limit when admin pool is unlimited", async () => {
      const a = agent();
      const admin = await createAdminUser();
      
      // Set unlimited admin daily limit
      await User.updateOne({ _id: admin._id }, { dailyLimit: 0 });
      
      await a.post("/login").type("form").send({ 
        email: "admin@example.com", 
        password: "password123" 
      });

      const res = await a.post("/technicians").type("form").send({
        name: "Tech One",
        email: "tech1@example.com",
        password: "techpass123",
        dailyLimit: "50"
      }).redirects(0);

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("/technicians");

      const tech = await User.findOne({ email: "tech1@example.com" }).lean();
      expect(tech.dailyLimit).toBe(50); // Should allow any value
    });

    it("normalizes email to lowercase", async () => {
      const a = agent();
      const admin = await createAdminUser();
      
      await a.post("/login").type("form").send({ 
        email: "admin@example.com", 
        password: "password123" 
      });

      const res = await a.post("/technicians").type("form").send({
        name: "Tech One",
        email: "TECH@EXAMPLE.COM",
        password: "techpass123",
        dailyLimit: "5"
      }).redirects(0);

      expect(res.status).toBe(302);

      const tech = await User.findOne({ email: "tech@example.com" }).lean();
      expect(tech).toBeTruthy();
      expect(tech.email).toBe("tech@example.com");
    });
  });

  describe("Update Technician", () => {
    it("updates technician successfully", async () => {
      const a = agent();
      const admin = await createAdminUser();
      
      await a.post("/login").type("form").send({ 
        email: "admin@example.com", 
        password: "password123" 
      });

      // Create technician
      await a.post("/technicians").type("form").send({
        name: "Original Tech",
        email: "original@example.com",
        password: "originalpass",
        dailyLimit: "5"
      });

      const tech = await User.findOne({ email: "original@example.com" });

      // Update technician
      const res = await a.post(`/technicians/${tech._id}/update`).type("form").send({
        name: "Updated Tech",
        email: "updated@example.com",
        password: "updatedpass",
        dailyLimit: "10",
        active: "on"
      }).redirects(0);

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("/technicians");

      const updated = await User.findById(tech._id).lean();
      expect(updated.name).toBe("Updated Tech");
      expect(updated.email).toBe("updated@example.com");
      expect(updated.dailyLimit).toBe(3);
      expect(updated.active).toBe(true);
    });

    it("prevents updating other admin's technician", async () => {
      const a = agent();
      const admin1 = await createAdminUser("admin1@example.com");
      const admin2 = await createAdminUser("admin2@example.com");
      
      // Create technician for admin1
      await a.post("/login").type("form").send({ 
        email: "admin1@example.com", 
        password: "password123" 
      });
      
      await a.post("/technicians").type("form").send({
        name: "Tech One",
        email: "tech1@example.com",
        password: "techpass123",
        dailyLimit: "5"
      });

      const tech = await User.findOne({ email: "tech1@example.com" });

      // Try to update as admin2
      await a.post("/login").type("form").send({ 
        email: "admin2@example.com", 
        password: "password123" 
      });

      const res = await a.post(`/technicians/${tech._id}/update`).type("form").send({
        name: "Hacked Tech",
        email: "hacked@example.com",
        password: "hackedpass",
        dailyLimit: "100"
      }).redirects(0);

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("/technicians");

      const notUpdated = await User.findById(tech._id).lean();
      expect(notUpdated.name).toBe("Tech One");
      expect(notUpdated.email).toBe("tech1@example.com");
    });

    it("prevents email collision with other users", async () => {
      const a = agent();
      const admin = await createAdminUser();
      
      await a.post("/login").type("form").send({ 
        email: "admin@example.com", 
        password: "password123" 
      });

      // Create two technicians
      await a.post("/technicians").type("form").send({
        name: "Tech One",
        email: "tech1@example.com",
        password: "techpass123",
        dailyLimit: "5"
      });

      await a.post("/technicians").type("form").send({
        name: "Tech Two",
        email: "tech2@example.com",
        password: "techpass123",
        dailyLimit: "5"
      });

      const tech1 = await User.findOne({ email: "tech1@example.com" });

      // Try to update tech1 with tech2's email
      const res = await a.post(`/technicians/${tech1._id}/update`).type("form").send({
        name: "Tech One",
        email: "tech2@example.com",
        password: "techpass123",
        dailyLimit: "5"
      }).redirects(0);

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("/technicians");

      const notUpdated = await User.findById(tech1._id).lean();
      expect(notUpdated.email).toBe("tech1@example.com");
    });

    it("handles password update", async () => {
      const a = agent();
      const admin = await createAdminUser();
      
      await a.post("/login").type("form").send({ 
        email: "admin@example.com", 
        password: "password123" 
      });

      // Create technician
      await a.post("/technicians").type("form").send({
        name: "Tech One",
        email: "tech1@example.com",
        password: "oldpass",
        dailyLimit: "5"
      });

      const tech = await User.findOne({ email: "tech1@example.com" });

      // Update with new password
      const res = await a.post(`/technicians/${tech._id}/update`).type("form").send({
        name: "Tech One",
        email: "tech1@example.com",
        password: "newpass",
        dailyLimit: "5"
      }).redirects(0);

      expect(res.status).toBe(302);

      // Verify new password works
      const a2 = agent();
      const loginRes = await a2.post("/login").type("form").send({
        email: "tech1@example.com",
        password: "newpass"
      });
      expect(loginRes.status).toBe(302);
      expect(loginRes.headers.location).toBe("/dashboard");
    });

    it("handles empty password (no change)", async () => {
      const a = agent();
      const admin = await createAdminUser();
      
      await a.post("/login").type("form").send({ 
        email: "admin@example.com", 
        password: "password123" 
      });

      // Create technician
      await a.post("/technicians").type("form").send({
        name: "Tech One",
        email: "tech1@example.com",
        password: "originalpass",
        dailyLimit: "5"
      });

      const tech = await User.findOne({ email: "tech1@example.com" });

      // Update without password
      const res = await a.post(`/technicians/${tech._id}/update`).type("form").send({
        name: "Updated Tech",
        email: "tech1@example.com",
        password: "",
        dailyLimit: "10"
      }).redirects(0);

      expect(res.status).toBe(302);

      // Verify original password still works
      const a2 = agent();
      const loginRes = await a2.post("/login").type("form").send({
        email: "tech1@example.com",
        password: "originalpass"
      });
      expect(loginRes.status).toBe(302);
      expect(loginRes.headers.location).toBe("/dashboard");
    });

    it("caps daily limit based on remaining admin pool", async () => {
      const a = agent();
      const admin = await createAdminUser();
      
      // Set admin daily limit
      await User.updateOne({ _id: admin._id }, { dailyLimit: 10 });
      
      await a.post("/login").type("form").send({ 
        email: "admin@example.com", 
        password: "password123" 
      });

      // Create two technicians
      await a.post("/technicians").type("form").send({
        name: "Tech One",
        email: "tech1@example.com",
        password: "techpass123",
        dailyLimit: "3"
      });

      await a.post("/technicians").type("form").send({
        name: "Tech Two",
        email: "tech2@example.com",
        password: "techpass123",
        dailyLimit: "3"
      });

      const tech1 = await User.findOne({ email: "tech1@example.com" });

      // Try to update tech1 with higher limit than remaining pool
      const res = await a.post(`/technicians/${tech1._id}/update`).type("form").send({
        name: "Tech One",
        email: "tech1@example.com",
        password: "techpass123",
        dailyLimit: "10"
      }).redirects(0);

      expect(res.status).toBe(302);

      const updated = await User.findById(tech1._id).lean();
      expect(updated.dailyLimit).toBe(7); // Actual capped value
    });

    it("handles active/inactive status", async () => {
      const a = agent();
      const admin = await createAdminUser();
      
      await a.post("/login").type("form").send({ 
        email: "admin@example.com", 
        password: "password123" 
      });

      // Create technician
      await a.post("/technicians").type("form").send({
        name: "Tech One",
        email: "tech1@example.com",
        password: "techpass123",
        dailyLimit: "5"
      });

      const tech = await User.findOne({ email: "tech1@example.com" });

      // Deactivate technician
      const res1 = await a.post(`/technicians/${tech._id}/update`).type("form").send({
        name: "Tech One",
        email: "tech1@example.com",
        password: "techpass123",
        dailyLimit: "5",
        active: "off"
      }).redirects(0);

      expect(res1.status).toBe(302);

      const deactivated = await User.findById(tech._id).lean();
      expect(deactivated.active).toBe(false);

      // Reactivate technician
      const res2 = await a.post(`/technicians/${tech._id}/update`).type("form").send({
        name: "Tech One",
        email: "tech1@example.com",
        password: "techpass123",
        dailyLimit: "5",
        active: "on"
      }).redirects(0);

      expect(res2.status).toBe(302);

      const reactivated = await User.findById(tech._id).lean();
      expect(reactivated.active).toBe(true);
    });
  });

  describe("Delete Technician", () => {
    it("deletes technician successfully", async () => {
      const a = agent();
      const admin = await createAdminUser();
      
      await a.post("/login").type("form").send({ 
        email: "admin@example.com", 
        password: "password123" 
      });

      // Create technician
      await a.post("/technicians").type("form").send({
        name: "Tech One",
        email: "tech1@example.com",
        password: "techpass123",
        dailyLimit: "5"
      });

      const tech = await User.findOne({ email: "tech1@example.com" });

      // Delete technician
      const res = await a.post(`/technicians/${tech._id}/delete`).redirects(0);
      expect(res.status).toBe(302);

      const deleted = await User.findById(tech._id);
      expect(deleted).toBeNull();
    });

    it("prevents deleting other admin's technician", async () => {
      const a = agent();
      const admin1 = await createAdminUser("admin1@example.com");
      const admin2 = await createAdminUser("admin2@example.com");
      
      // Create technician for admin1
      await a.post("/login").type("form").send({ 
        email: "admin1@example.com", 
        password: "password123" 
      });
      
      await a.post("/technicians").type("form").send({
        name: "Tech One",
        email: "tech1@example.com",
        password: "techpass123",
        dailyLimit: "5"
      });

      const tech = await User.findOne({ email: "tech1@example.com" });

      // Try to delete as admin2
      await a.post("/login").type("form").send({ 
        email: "admin2@example.com", 
        password: "password123" 
      });

      const res = await a.post(`/technicians/${tech._id}/delete`).redirects(0);
      expect(res.status).toBe(302);

      const notDeleted = await User.findById(tech._id);
      expect(notDeleted).toBeTruthy();
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

      // Login as technician
      await a.post("/login").type("form").send({ 
        email: "tech@example.com", 
        password: "techpass123" 
      });

      const res = await a.post(`/technicians/${tech._id}/delete`).redirects(0);
      expect(res.status).toBe(403);

      const notDeleted = await User.findById(tech._id);
      expect(notDeleted).toBeTruthy();
    });
  });

  describe("Pool Management", () => {
    it("correctly calculates remaining pool capacity", async () => {
      const a = agent();
      const admin = await createAdminUser();
      
      // Set admin daily limit
      await User.updateOne({ _id: admin._id }, { dailyLimit: 20 });
      
      await a.post("/login").type("form").send({ 
        email: "admin@example.com", 
        password: "password123" 
      });

      // Create technicians with different limits
      await a.post("/technicians").type("form").send({
        name: "Tech One",
        email: "tech1@example.com",
        password: "techpass123",
        dailyLimit: "5"
      });

      await a.post("/technicians").type("form").send({
        name: "Tech Two",
        email: "tech2@example.com",
        password: "techpass123",
        dailyLimit: "8"
      });

      // Remaining pool should be 20 - 5 - 8 = 7
      const remainingPool = await User.aggregate([
        { $match: { role: "technician", owner: admin._id } },
        { $group: { _id: null, total: { $sum: { $ifNull: ["$dailyLimit", 0] } } } },
      ]);

      const usedPool = remainingPool[0]?.total || 0;
      const adminDoc = await User.findById(admin._id).lean();
      const remaining = Math.max(0, adminDoc.dailyLimit - usedPool);
      
      expect(remaining).toBe(7);
    });

    it("handles unlimited admin pool correctly", async () => {
      const a = agent();
      const admin = await createAdminUser();
      
      // Set unlimited admin daily limit
      await User.updateOne({ _id: admin._id }, { dailyLimit: 0 });
      
      await a.post("/login").type("form").send({ 
        email: "admin@example.com", 
        password: "password123" 
      });

      // Should be able to create technicians with any limit
      const res = await a.post("/technicians").type("form").send({
        name: "Tech One",
        email: "tech1@example.com",
        password: "techpass123",
        dailyLimit: "1000"
      }).redirects(0);

      expect(res.status).toBe(302);

      const tech = await User.findOne({ email: "tech1@example.com" }).lean();
      expect(tech.dailyLimit).toBe(1000);
    });
  });
});
