// models/user.model.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    name: { type: String, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },

    // Daily limit:
    // - For admins: this is the *account pool* shared by them + all technicians.
    // - For technicians: personal cap (consumed from the admin pool).
    dailyLimit: { type: Number, default: 20, min: 0 },

    // Roles support existing "user" plus new "admin"/"technician"
    role: { type: String, enum: ["user", "admin", "technician"], default: "admin", index: true },

    // If role === 'technician', who is their admin?
    owner: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },

    // Technicians can be deactivated
    active: { type: Boolean, default: true },
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

const User = mongoose.models.User || mongoose.model("User", userSchema);
export default User;
