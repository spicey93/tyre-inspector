// tests/auth.comprehensive.spec.js
import { agent } from "./utils/testAgent.js";
import User from "../models/user.model.js";

describe("Authentication Comprehensive Tests", () => {
  describe("Registration", () => {
    it("registers new user successfully", async () => {
      const a = agent();
      
      const res = await a.post("/register")
        .type("form")
        .send({ 
          name: "Test User", 
          email: "test@example.com", 
          password: "password123" 
        });

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("/dashboard");

      const user = await User.findOne({ email: "test@example.com" }).lean();
      expect(user).toBeTruthy();
      expect(user.name).toBe("Test User");
      expect(user.role).toBe("admin");
      expect(typeof user.dailyLimit).toBe("number");
      expect(user.dailyLimit).toBe(3); // Default value
    });

    it("sets session after registration", async () => {
      const a = agent();
      
      await a.post("/register")
        .type("form")
        .send({ 
          name: "Session User", 
          email: "session@example.com", 
          password: "password123" 
        });

      // Should be able to access dashboard
      const dashboardRes = await a.get("/dashboard");
      expect(dashboardRes.status).toBe(200);
      expect(dashboardRes.text).toMatch(/Dashboard/);
    });

    it("prevents duplicate email registration", async () => {
      const a = agent();
      
      // First registration
      await a.post("/register")
        .type("form")
        .send({ 
          name: "First User", 
          email: "duplicate@example.com", 
          password: "password123" 
        });

      // Second registration with same email
      const res = await a.post("/register")
        .type("form")
        .send({ 
          name: "Second User", 
          email: "duplicate@example.com", 
          password: "password456" 
        });

      expect(res.status).toBe(400);
      expect(res.text).toMatch(/Registration failed/);

      const users = await User.find({ email: "duplicate@example.com" }).lean();
      expect(users.length).toBe(1);
    });

    it("handles missing required fields", async () => {
      const a = agent();
      
      // Missing name
      const res1 = await a.post("/register")
        .type("form")
        .send({ 
          email: "missing@example.com", 
          password: "password123" 
        });

      expect(res1.status).toBe(400);
      expect(res1.text).toMatch(/Registration failed/);

      // Missing email
      const res2 = await a.post("/register")
        .type("form")
        .send({ 
          name: "Missing Email", 
          password: "password123" 
        });

      expect(res2.status).toBe(400);
      expect(res2.text).toMatch(/Registration failed/);

      // Missing password
      const res3 = await a.post("/register")
        .type("form")
        .send({ 
          name: "Missing Password", 
          email: "missing@example.com" 
        });

      expect(res3.status).toBe(400);
      expect(res3.text).toMatch(/Registration failed/);
    });

    it("normalizes email to lowercase", async () => {
      const a = agent();
      
      await a.post("/register")
        .type("form")
        .send({ 
          name: "Case User", 
          email: "CASE@EXAMPLE.COM", 
          password: "password123" 
        });

      const user = await User.findOne({ email: "case@example.com" }).lean();
      expect(user).toBeTruthy();
      expect(user.email).toBe("case@example.com");
    });

    it("trims whitespace from name and email", async () => {
      const a = agent();
      
      await a.post("/register")
        .type("form")
        .send({ 
          name: "  Trimmed User  ", 
          email: "  trimmed@example.com  ", 
          password: "password123" 
        });

      const user = await User.findOne({ email: "trimmed@example.com" }).lean();
      expect(user).toBeTruthy();
      expect(user.name).toBe("Trimmed User");
      expect(user.email).toBe("trimmed@example.com");
    });
  });

  describe("Login", () => {
    it("logs in existing user successfully", async () => {
      const a = agent();
      
      // Register user first
      await a.post("/register")
        .type("form")
        .send({ 
          name: "Login User", 
          email: "login@example.com", 
          password: "password123" 
        });

      // Clear session
      await a.get("/logout");

      // Login
      const res = await a.post("/login")
        .type("form")
        .send({ 
          email: "login@example.com", 
          password: "password123" 
        });

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("/dashboard");
    });

    it("fails login with incorrect password", async () => {
      const a = agent();
      
      // Register user first
      await a.post("/register")
        .type("form")
        .send({ 
          name: "Wrong Pass User", 
          email: "wrongpass@example.com", 
          password: "correctpass" 
        });

      // Clear session
      await a.get("/logout");

      // Try login with wrong password
      const res = await a.post("/login")
        .type("form")
        .send({ 
          email: "wrongpass@example.com", 
          password: "wrongpass" 
        });

      expect(res.status).toBe(401);
      expect(res.text).toMatch(/Incorrect credentials/);
    });

    it("fails login with non-existent email", async () => {
      const a = agent();
      
      const res = await a.post("/login")
        .type("form")
        .send({ 
          email: "nonexistent@example.com", 
          password: "password123" 
        });

      expect(res.status).toBe(401);
      expect(res.text).toMatch(/Incorrect credentials/);
    });

    it("handles case-insensitive email login", async () => {
      const a = agent();
      
      // Register with lowercase email
      await a.post("/register")
        .type("form")
        .send({ 
          name: "Case User", 
          email: "case@example.com", 
          password: "password123" 
        });

      // Clear session
      await a.get("/logout");

      // Login with uppercase email
      const res = await a.post("/login")
        .type("form")
        .send({ 
          email: "CASE@EXAMPLE.COM", 
          password: "password123" 
        });

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("/dashboard");
    });

    it("redirects to specified next URL after login", async () => {
      const a = agent();
      
      // Register user first
      await a.post("/register")
        .type("form")
        .send({ 
          name: "Next User", 
          email: "next@example.com", 
          password: "password123" 
        });

      // Clear session
      await a.get("/logout");

      // Login with next parameter
      const res = await a.post("/login")
        .type("form")
        .send({ 
          email: "next@example.com", 
          password: "password123",
          next: "/inspections"
        });

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("/inspections");
    });

    it("handles missing email or password", async () => {
      const a = agent();
      
      // Missing email
      const res1 = await a.post("/login")
        .type("form")
        .send({ 
          password: "password123" 
        });

      expect(res1.status).toBe(401);
      expect(res1.text).toMatch(/Incorrect credentials/);

      // Missing password
      const res2 = await a.post("/login")
        .type("form")
        .send({ 
          email: "test@example.com" 
        });

      expect(res2.status).toBe(401);
      expect(res2.text).toMatch(/Incorrect credentials/);
    });

    it("prevents login for inactive technician", async () => {
      const a = agent();
      
      // Register admin
      await a.post("/register")
        .type("form")
        .send({ 
          name: "Admin User", 
          email: "admin@example.com", 
          password: "password123" 
        });

      // Create inactive technician
      await a.post("/login")
        .type("form")
        .send({ 
          email: "admin@example.com", 
          password: "password123" 
        });

      await a.post("/technicians").type("form").send({
        name: "Inactive Tech",
        email: "inactive@example.com",
        password: "techpass123",
        dailyLimit: "5"
      });

      const tech = await User.findOne({ email: "inactive@example.com" });
      await User.updateOne({ _id: tech._id }, { active: false });

      // Clear session
      await a.get("/logout");

      // Try to login as inactive technician
      const res = await a.post("/login")
        .type("form")
        .send({ 
          email: "inactive@example.com", 
          password: "techpass123" 
        });

      expect(res.status).toBe(401);
      expect(res.text).toMatch(/Incorrect credentials/);
    });
  });

  describe("Logout", () => {
    it("logs out user and clears session", async () => {
      const a = agent();
      
      // Register and login
      await a.post("/register")
        .type("form")
        .send({ 
          name: "Logout User", 
          email: "logout@example.com", 
          password: "password123" 
        });

      // Verify logged in
      let dashboardRes = await a.get("/dashboard");
      expect(dashboardRes.status).toBe(200);

      // Logout
      const logoutRes = await a.get("/logout");
      expect(logoutRes.status).toBe(302);
      expect(logoutRes.headers.location).toBe("/login");

      // Verify logged out
      dashboardRes = await a.get("/dashboard").redirects(0);
      expect(dashboardRes.status).toBe(401);
    });

    it("redirects to home page after logout", async () => {
      const a = agent();
      
      // Register and login
      await a.post("/register")
        .type("form")
        .send({ 
          name: "Home User", 
          email: "home@example.com", 
          password: "password123" 
        });

      // Logout
      const res = await a.get("/logout");
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("/login");
    });
  });

  describe("Session Management", () => {
    it("maintains session across requests", async () => {
      const a = agent();
      
      // Register and login
      await a.post("/register")
        .type("form")
        .send({ 
          name: "Session User", 
          email: "session@example.com", 
          password: "password123" 
        });

      // Multiple requests should maintain session
      const res1 = await a.get("/dashboard");
      expect(res1.status).toBe(200);

      const res2 = await a.get("/inspections");
      expect(res2.status).toBe(200);

      const res3 = await a.get("/dashboard");
      expect(res3.status).toBe(200);
    });

    it("attaches user to request object", async () => {
      const a = agent();
      
      // Register and login
      await a.post("/register")
        .type("form")
        .send({ 
          name: "Request User", 
          email: "request@example.com", 
          password: "password123" 
        });

      // Access dashboard (which uses req.user)
      const res = await a.get("/dashboard");
      expect(res.status).toBe(200);
    });

    it("handles invalid session gracefully", async () => {
      const a = agent();
      
      // Register and login
      await a.post("/register")
        .type("form")
        .send({ 
          name: "Invalid User", 
          email: "invalid@example.com", 
          password: "password123" 
        });

      // Manually corrupt session by deleting user
      const user = await User.findOne({ email: "invalid@example.com" });
      await User.deleteOne({ _id: user._id });

      // Should handle gracefully
      const res = await a.get("/dashboard").redirects(0);
      expect(res.status).toBe(401);
    });
  });

  describe("Password Security", () => {
    it("hashes passwords securely", async () => {
      const a = agent();
      
      await a.post("/register")
        .type("form")
        .send({ 
          name: "Hash User", 
          email: "hash@example.com", 
          password: "password123" 
        });

      const user = await User.findOne({ email: "hash@example.com" }).lean();
      expect(user.passwordHash).not.toBe("password123");
      expect(user.passwordHash).toMatch(/^\$2[aby]\$\d{1,2}\$/); // bcrypt format
    });

    it("verifies passwords correctly", async () => {
      const a = agent();
      
      await a.post("/register")
        .type("form")
        .send({ 
          name: "Verify User", 
          email: "verify@example.com", 
          password: "password123" 
        });

      const user = await User.findOne({ email: "verify@example.com" });
      
      // Test password verification
      const isValid = await user.verifyPassword("password123");
      expect(isValid).toBe(true);

      const isInvalid = await user.verifyPassword("wrongpassword");
      expect(isInvalid).toBe(false);
    });
  });

  describe("User Roles", () => {
    it("sets default role to admin for new registrations", async () => {
      const a = agent();
      
      await a.post("/register")
        .type("form")
        .send({ 
          name: "Role User", 
          email: "role@example.com", 
          password: "password123" 
        });

      const user = await User.findOne({ email: "role@example.com" }).lean();
      expect(user.role).toBe("admin");
    });

    it("sets default daily limit for new registrations", async () => {
      const a = agent();
      
      await a.post("/register")
        .type("form")
        .send({ 
          name: "Limit User", 
          email: "limit@example.com", 
          password: "password123" 
        });

      const user = await User.findOne({ email: "limit@example.com" }).lean();
      expect(user.dailyLimit).toBe(3);
    });
  });

  describe("Form Validation", () => {
    it("handles empty form submissions", async () => {
      const a = agent();
      
      const res = await a.post("/register")
        .type("form")
        .send({});

      expect(res.status).toBe(400);
      expect(res.text).toMatch(/Registration failed/);
    });

    it("handles malformed form data", async () => {
      const a = agent();
      
      const res = await a.post("/login")
        .type("form")
        .send({
          email: "test@example.com",
          password: null
        });

      expect(res.status).toBe(401);
      expect(res.text).toMatch(/Incorrect credentials/);
    });
  });

  describe("Redirect Behavior", () => {
    it("redirects authenticated users from login to dashboard", async () => {
      const a = agent();
      
      // Register and login
      await a.post("/register")
        .type("form")
        .send({ 
          name: "Redirect User", 
          email: "redirect@example.com", 
          password: "password123" 
        });

      // Try to access login page while authenticated
      const res = await a.get("/login").redirects(0);
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("/dashboard");
    });

    it("redirects authenticated users from register to dashboard", async () => {
      const a = agent();
      
      // Register and login
      await a.post("/register")
        .type("form")
        .send({ 
          name: "Register Redirect User", 
          email: "register@example.com", 
          password: "password123" 
        });

      // Try to access register page while authenticated
      const res = await a.get("/register").redirects(0);
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("/dashboard");
    });
  });
});
