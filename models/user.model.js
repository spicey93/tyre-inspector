// models/user.model.js
import mongoose from "mongoose";
import bcrypt from "bcrypt";

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    name: { type: String, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    dailyLimit: { type: Number, default: 20, min: 0 }, // per-user limit
    role: { type: String, enum: ["admin", "technician"], default: "technician" },
    plan: { type: String, enum: ["free", "paid"], default: "free" },
    admin: { type: Schema.Types.ObjectId, ref: "User", default: null }, // owning admin for technicians
  },
  { timestamps: true, versionKey: false }
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ admin: 1 });

userSchema.methods.setPassword = async function (plain) {
  this.passwordHash = await bcrypt.hash(plain, 12);
};

userSchema.methods.verifyPassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

const User = mongoose.model("User", userSchema);
export default User;
