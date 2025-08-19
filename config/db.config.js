// config/db.config.js
import mongoose from "mongoose";

const dbUrl = process.env.DB_URL;

const connectDB = async () => {
  try {
    await mongoose.connect(dbUrl);
    console.log("✅ Database connected");
  } catch (e) {
    console.error("❌ Error connecting to database");
    console.error(e);
  }
};

export { connectDB };
