import mongoose from "mongoose";
const { Schema } = mongoose;

const tyreSchema = new Schema({
    brand: {
        type: String,
        required: true,
        unique: true,
    },
    models: [
        {
            type: String,
            unique: true,
        }
    ]
});

const Tyre = mongoose.model("Tyre", tyreSchema);

export default Tyre;
