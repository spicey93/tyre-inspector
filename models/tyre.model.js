import mongoose from "mongoose";
const { Schema } = mongoose;

const tyreSchema = new Schema({});

const Tyre = mongoose.model("Tyre", tyreSchema);

export default Tyre;
