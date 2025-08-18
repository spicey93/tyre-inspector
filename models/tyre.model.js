// models/tyre.model.js
import mongoose from "mongoose";
const { Schema } = mongoose;

const tyreSchema = new Schema({
  brand: { type: String, required: true, unique: true, trim: true },
  models: [{ type: String, trim: true }],
});

const Tyre = mongoose.model("Tyre", tyreSchema);
export default Tyre;
