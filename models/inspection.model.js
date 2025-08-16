import mongoose from "mongoose";
import crypto from "node:crypto";

const tyreSchema = new mongoose.Schema({
  treadDepth: {
    inner: { type: Number, min: 0 },
    middle: { type: Number, min: 0 },
    outer: { type: Number, min: 0 },
  },
  psi: { type: Number, min: 0 },
  brand: { type: String, trim: true },
  dot: { type: String, trim: true }, // DOT codes are string
  notes: { type: String, trim: true },
  status: { type: String, enum: ["Good", "Warning", "Bad"], default: "Good" },
});

const inspectionSchema = new mongoose.Schema(
  {
    code: { type: String, unique: true, index: true }, // unique inspection code
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
      spare: tyreSchema,
    },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

// Helper: make an 8-char hex code (4 random bytes)
function makeHexCode() {
  return crypto.randomBytes(4).toString("hex").toUpperCase(); // 8 chars
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

inspectionSchema.post("save", function (error, doc, next) {
  if (error && error.code === 11000 && error.keyPattern?.code) {
    next(new Error("Collision on generated code; please retry the save."));
  } else {
    next(error);
  }
});

const Inspection = mongoose.model("Inspection", inspectionSchema);
export default Inspection;
