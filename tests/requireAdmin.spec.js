// tests/requireAdmin.spec.js
import { describe, it, expect } from "vitest";
import requireAdmin from "../middleware/requireAdmin.js";

function mockReqRes(user = null) {
  const req = { user };
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(msg) {
      this.body = msg;
      return this;
    },
    redirect(url) {
      this.redirectUrl = url;
      this.statusCode = 302;
      return this;
    },
  };
  const next = vi.fn();
  return { req, res, next };
}

describe("requireAdmin middleware", () => {
  it("responds 401 when not logged in", () => {
    const { req, res, next } = mockReqRes();
    requireAdmin(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(res.body).toMatch(/login required/i);
    expect(next).not.toHaveBeenCalled();
  });

  it("responds 403 for non-admin user", () => {
    const { req, res, next } = mockReqRes({ role: "technician" });
    requireAdmin(req, res, next);
    expect(res.statusCode).toBe(403);
    expect(res.body).toMatch(/admins only/i);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next for admin user", () => {
    const { req, res, next } = mockReqRes({ role: "admin" });
    requireAdmin(req, res, next);
    expect(res.statusCode).toBe(200);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
