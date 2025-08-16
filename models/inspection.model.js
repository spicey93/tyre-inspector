import mongoose from "mongoose";
import crypto from "node:crypto";

const tyreSchema = new mongoose.Schema({
  // NEW: common tyre size string (e.g., "205/55 R16 91V")
  size: {
    type: String,
    trim: true,
    // Accepts "205/55R16", "205/55 R16", optionally with load+speed e.g. "91V"
    match: [/^\d{3}\/\d{2}\s*R\d{2}(?:\s*\d{2,3}[A-Z])?$/i, "Tyre size must look like 205/55 R16 91V"],
  },
  treadDepth: {
    inner: { type: Number, min: 0 },
    middle: { type: Number, min: 0 },
    outer: { type: Number, min: 0 },
  },
  psi: { type: Number, min: 0 },
  brand: { type: String, trim: true },
  dot: { type: String, trim: true }, // keep as string to preserve leading zeros
  notes: { type: String, trim: true },
  status: { type: String, enum: ["Good", "Warning", "Bad"], default: "Good" },
});

const inspectionSchema = new mongoose.Schema(
  {
    code: { type: String, unique: true, index: true }, // 8-char hex code
    vrm: { type: String, trim: true },
    mileage: { type: String, trim: true },
    tyres: {
      nearside: {
        front: tyreSchema,
        rear: tyreSchema,
      },
      offside: {
        front: tyreSchema,
        rear: tyreSchema,
      },
      // REMOVED: spare
    },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

// 8-char hex code
function makeHexCode() {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

inspectionSchema.pre("validate", async function () {
  if (this.code) return;
  const Model = this.constructor;
  let candidate;
  do {
    candidate = makeHexCode();
  } while (await Model.exists({ code: candidate }));
  this.code = candidate;
});

inspectionSchema.post("save", function (error, _doc, next) {
  if (error && error.code === 11000 && error.keyPattern?.code) {
    next(new Error("Collision on generated code; please retry the save."));
  } else {
    next(error);
  }
});

const Inspection = mongoose.model("Inspection", inspectionSchema);
export default Inspection;
