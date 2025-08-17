import mongoose from "mongoose";
const { Schema } = mongoose;

const tyreSchema = new Schema({
  brand: { type: String, required: true, unique: true, trim: true },
  models: [{ type: String, trim: true }],
});

// Enforce unique (brand, model) pairs across the array elements
tyreSchema.index({ brand: 1, models: 1 }, { unique: true });

const Tyre = mongoose.model("Tyre", tyreSchema);
export default Tyre;
