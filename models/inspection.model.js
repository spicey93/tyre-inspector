// models/inspection.model.js
import mongoose from "mongoose";
import { customAlphabet } from "nanoid";

const { Schema } = mongoose;

// ---- helpers ----
const depthNum = { type: Number, min: 0, max: 20 }; // mm
const pressureNum = { type: Number, min: 0, max: 500 }; // psi or kPa (pick one)

const TyreSubSchema = new Schema(
  {
    treadDepth: {
      inner: depthNum,
      middle: depthNum,
      outer: depthNum,
    },
    pressure: pressureNum,
    dot: { type: String, trim: true },
    brand: { type: String, trim: true },
    model: { type: String, trim: true },
    size: { type: String, trim: true },
    notes: { type: String, trim: true, maxlength: 2000 },
    condition: {
      type: String,
      enum: ["ok", "advisory", "fail"],
      default: "ok",
    },
    tags: [{ type: String, trim: true }],
  },
  { _id: false }
);

// ---- short share code ----
// exclude look-alikes O/0 and I/1; use A–Z, 2–9
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const nanoid = customAlphabet(alphabet, 6);

// ---- inspection schema ----
const inspectionSchema = new Schema(
  {
    // OWNER of the record (always the admin account)
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

    // Who created it (admin or technician)
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },

    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      minlength: 6,
      maxlength: 6,
      match: /^[A-Z0-9]{6}$/,
    },
    vrm: { type: String, required: true, trim: true },
    mileage: { type: Number, min: 0 },
    notes: { type: String, trim: true },

    offside: { front: TyreSubSchema, rear: TyreSubSchema },
    nearside: { front: TyreSubSchema, rear: TyreSubSchema },
  },
  { timestamps: true, versionKey: false }
);

// indexes
inspectionSchema.index({ vrm: 1, createdAt: -1 });
inspectionSchema.index({ user: 1, createdAt: -1 });

// unique code generator (with retries)
inspectionSchema.statics.generateUniqueCode = async function () {
  for (let i = 0; i < 5; i++) {
    const candidate = nanoid();
    const exists = await this.exists({ code: candidate });
    if (!exists) return candidate;
  }
  throw new Error("Could not generate unique code");
};

const Inspection = mongoose.models.Inspection || mongoose.model("Inspection", inspectionSchema);
export default Inspection;
