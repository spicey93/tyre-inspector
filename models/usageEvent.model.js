// models/usageEvent.model.js
import mongoose from "mongoose";
const { Schema } = mongoose;

const usageEventSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", index: true, required: true },
    type: { type: String, enum: ["vrm_lookup"], required: true, index: true },
    meta: { type: Schema.Types.Mixed }, // { vrm, reason: "explicit_lookup" | "implicit_from_inspection" }
  },
  { timestamps: true, versionKey: false }
);

usageEventSchema.index({ user: 1, type: 1, "meta.vrm": 1, createdAt: 1 });

const UsageEvent = mongoose.model("UsageEvent", usageEventSchema);
export default UsageEvent;
