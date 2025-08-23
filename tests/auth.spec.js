// tests/auth.spec.js
import { agent } from "./utils/testAgent.js";
import User from "../models/user.model.js";

describe("Auth flows", () => {
  it("registers a new user and redirects to /dashboard", async () => {
    const a = agent();

    const res = await a
      .post("/register")
      .type("form")
      .send({ name: "Alice", email: "alice@example.com", password: "pass1234" });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/dashboard");

    // session cookie should exist
    const user = await User.findOne({ email: "alice@example.com" }).lean();
    expect(user).toBeTruthy();
    expect(typeof user.dailyLimit).toBe("number");
  });

  it("fails login with bad credentials", async () => {
    const a = agent();
    // seed a user
    const u = new User({
      name: "Bob",
      email: "bob@example.com",
      passwordHash: "",
      dailyLimit: 5,
      role: "admin",
    });
    await u.setPassword("secret");
    await u.save();

    const bad = await a
      .post("/login")
      .type("form")
      .send({ email: "bob@example.com", password: "wrong" });

    expect(bad.status).toBe(401);
    expect(bad.text).toMatch(/Incorrect credentials/);
  });
});
