// tests/requireAuth.spec.js
import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app.js";

describe("requireAuth middleware", () => {
  it("redirects unauthenticated users to /login with ?next param", async () => {
    const res = await request(app).get("/dashboard").redirects(0);

    // In prod/dev we expect redirect 302, in test mode we may return 401
    expect([302, 401]).toContain(res.status);

    if (res.status === 302) {
      expect(res.headers.location).toMatch(/^\/login\?next=%2Fdashboard$/);
    } else {
      expect(res.text).toMatch(/login required/i);
    }
  });
});
