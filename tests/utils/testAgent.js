// tests/utils/testAgent.js
// Ensure test env bits are set before importing the app.
// (Your global tests/setup.js sets DB_URL already.)
process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.SESSION_SECRET = process.env.SESSION_SECRET || "testsecret";

import request from "supertest";
import app from "../../app.js";

// supertest agent keeps cookies across requests (session)
export function agent() {
  return request.agent(app);
}
