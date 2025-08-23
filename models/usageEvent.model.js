// models/usageEvent.model.js
import mongoose from "mongoose";
const { Schema } = mongoose;

const usageEventSchema = new Schema(
  {
    // Who performed the action
    user: { type: Schema.Types.ObjectId, ref: "User", index: true, required: true },

    // Whose pool is billed (admin account). Optional for migration-safety,
    // but new code should always set it.
    billedTo: { type: Schema.Types.ObjectId, ref: "User", index: true, default: null },

    type: { type: String, enum: ["vrm_lookup"], required: true, index: true },
    meta: { type: Schema.Types.Mixed }, // { vrm, reason: "explicit_lookup" | "implicit_from_inspection" | ... }
  },
  { timestamps: true, versionKey: false }
);

usageEventSchema.index({ user: 1, type: 1, "meta.vrm": 1, createdAt: 1 });
usageEventSchema.index({ billedTo: 1, createdAt: 1 });

const UsageEvent = mongoose.models.UsageEvent || mongoose.model("UsageEvent", usageEventSchema);
export default UsageEvent;
