// models/usageEvent.model.js
import mongoose from "mongoose";

const { Schema } = mongoose;

const usageEventSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", index: true, required: true },
    type: { type: String, enum: ["vrm_lookup", "inspection_create"], required: true, index: true },
    // optional metadata if you want to analyze later (e.g., which VRM was looked up)
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: true, versionKey: false }
);

// helpful compound index for time-bounded queries
usageEventSchema.index({ user: 1, createdAt: 1 });

const UsageEvent = mongoose.model("UsageEvent", usageEventSchema);
export default UsageEvent;
