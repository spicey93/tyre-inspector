// models/user.model.js
import mongoose from "mongoose";
import bcrypt from "bcrypt";

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    name: { type: String, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    dailyLimit: { type: Number, default: 20, min: 0 },   // per-user limit
    // role based access control
    role: { type: String, enum: ["admin", "technician"], default: "technician" },
    // when a technician is created by an admin, store the admin's id
    admin: { type: Schema.Types.ObjectId, ref: "User" },
    // subscription tier controls how many technicians an admin can create
    accountStatus: { type: String, enum: ["free", "paid"], default: "free" },
  },
  { timestamps: true, versionKey: false }
);

userSchema.index({ email: 1 }, { unique: true });

userSchema.methods.setPassword = async function (plain) {
  this.passwordHash = await bcrypt.hash(plain, 12);
};

userSchema.methods.verifyPassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

const User = mongoose.model("User", userSchema);
export default User;
