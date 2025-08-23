// tests/setupTestDB.js
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongo;

export async function connectTestDB() {
  if (!mongo) {
    mongo = await MongoMemoryServer.create();
  }
  const uri = mongo.getUri();

  // Only connect once
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
  }
}

export async function disconnectTestDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase().catch(() => {});
    await mongoose.disconnect().catch(() => {});
  }
  if (mongo) {
    await mongo.stop();
    mongo = null;
  }
}
