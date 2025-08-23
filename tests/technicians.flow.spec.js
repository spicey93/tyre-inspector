// tests/technicians.flow.spec.js
import { describe, it, expect } from "vitest";
import { agent as mkAgent } from "./utils/testAgent.js";
import User from "../models/user.model.js";

async function registerAndLoginAdmin(email = "boss@example.com", password = "pass1234") {
  const a = mkAgent();
  await a.post("/register").type("form").send({ name: "Boss", email, password });
  await a.post("/login").type("form").send({ email, password, next: "/technicians" });
  const admin = await User.findOne({ email }).lean();
  return { a, admin };
}

describe("Technicians admin flow", () => {
  it("creates up to the max technicians and blocks further ones", async () => {
    const { a, admin } = await registerAndLoginAdmin();

    // 1
    let res = await a
      .post("/technicians")
      .type("form")
      .send({ name: "Tech One", email: "t1@example.com", password: "techpass", dailyLimit: "2" })
      .redirects(0);
    expect(res.status).toBe(302);

    // 2
    res = await a
      .post("/technicians")
      .type("form")
      .send({ name: "Tech Two", email: "t2@example.com", password: "techpass", dailyLimit: "2" })
      .redirects(0);
    expect(res.status).toBe(302);

    // 3 -> blocked by MAX_TECHNICIANS (controller should flash + redirect)
    res = await a
      .post("/technicians")
      .type("form")
      .send({ name: "Tech Three", email: "t3@example.com", password: "techpass", dailyLimit: "2" })
      .redirects(0);
    expect(res.status).toBe(302);

    const techs = await User.find({ role: "technician", owner: admin._id }).lean();
    expect(techs.length).toBe(2);
  });

  it("prevents duplicate technician email globally", async () => {
    const { a, admin } = await registerAndLoginAdmin();

    // Seed one tech
    await a
      .post("/technicians")
      .type("form")
      .send({ name: "Tech One", email: "dup@example.com", password: "techpass", dailyLimit: "2" })
      .redirects(0);

    // Try to create another with the same email
    const res = await a
      .post("/technicians")
      .type("form")
      .send({ name: "Dup Again", email: "dup@example.com", password: "newpass", dailyLimit: "1" })
      .redirects(0);
    expect(res.status).toBe(302);

    const techs = await User.find({ role: "technician", owner: admin._id }).lean();
    expect(techs.length).toBe(1);
  });

  it("disallows VRM lookup for inactive technician", async () => {
    const { a } = await registerAndLoginAdmin();

    // Create a tech then deactivate
    await a
      .post("/technicians")
      .type("form")
      .send({ name: "Tech One", email: "inactive@example.com", password: "techpass", dailyLimit: "2" })
      .redirects(0);

    const tech = await User.findOne({ email: "inactive@example.com" }).lean();

    const resUpdate = await a
      .post(`/technicians/${tech._id}/update`)
      .type("form")
      .send({ name: "Tech One", email: "inactive@example.com", password: "", dailyLimit: "2", active: "off" })
      .redirects(0);
    expect(resUpdate.status).toBe(302);

    // Login as that tech
    const techAgent = mkAgent();
    await techAgent
      .post("/login")
      .type("form")
      .send({ email: "inactive@example.com", password: "techpass", next: "/dashboard" });

    // VRM lookup should be blocked
    const vrmRes = await techAgent.post("/vrm").type("form").send({ vrm: "AB12 CDE" }).redirects(0);
    expect(vrmRes.status).toBe(403);
    expect(vrmRes.text).toMatch(/Technician is inactive/);
  });
});
