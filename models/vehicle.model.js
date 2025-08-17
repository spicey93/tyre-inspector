import mongoose from "mongoose";
const { Schema } = mongoose;

const vehicleSchema = new Schema({
  vrm: {
    type: String,
    required: true,
    unique: true,
  },
  make: {
    type: String,
    required: true,
  },
  model: {
    type: String,
    required: true,
  },
  year: {
    type: String,
    required: true,
  },
  tyreRecords: [
    {
      front: {
        size: {
          type: String,
          required: true,
        },
        runflat: {
          type: Boolean,
        },
        pressure: {
          type: Number,
        },
      },
      rear: {
        size: {
          type: String,
          required: true,
        },
        runflat: {
          type: Boolean,
        },
        pressure: {
          type: Number,
        },
      },
    },
  ],
  torque: {
    type: String,
  },
});

const Vehicle = mongoose.model("Vehicle", vehicleSchema);

export default Vehicle;
