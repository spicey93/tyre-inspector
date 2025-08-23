// tests/setup.js
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongod;

export async function globalSetup() {
  // Silence noisy logs during tests (optional)
  process.env.NODE_ENV = "test";
  process.env.SESSION_SECRET = "test-secret";

  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  process.env.DB_URL = uri;

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 20000,
  });
}

export async function globalTeardown() {
  await mongoose.connection.dropDatabase().catch(() => {});
  await mongoose.connection.close().catch(() => {});
  if (mongod) await mongod.stop();
}

// Vitest lifecycle
beforeAll(async () => {
  await globalSetup();
});

afterEach(async () => {
  // Clean all collections after each test for isolation
  const { connections } = mongoose;
  const conn = connections[0];
  if (!conn) return;
  const collections = await conn.db.collections();
  for (const c of collections) {
    // Keep system collections safe
    if (!c.collectionName.startsWith("system.")) {
      await c.deleteMany({});
    }
  }
});

afterAll(async () => {
  await globalTeardown();
});
