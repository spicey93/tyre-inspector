import mongoose from "mongoose";
const { Schema } = mongoose;

// tiny helpers
const depthNum = { type: Number, min: 0, max: 20 }; // mm (adjust if you want)
const pressureNum = { type: Number, min: 0, max: 500 }; // kPa or psi depending on what you store

// make it a real sub-schema so we can disable _id and add trims/validators
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
  },
  { _id: false }
);

const inspectionSchema = new Schema(
  {
    vrm: { type: String, required: true, trim: true },
    mileage: { type: Number, min: 0 },
    notes: { type: String, trim: true },

    offside: {
      front: TyreSubSchema,
      rear: TyreSubSchema,
    },
    nearside: {
      front: TyreSubSchema,
      rear: TyreSubSchema,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// handy for "latest inspection per plate"
inspectionSchema.index({ vrm: 1, createdAt: -1 });

const Inspection = mongoose.model("Inspection", inspectionSchema);
export default Inspection;
