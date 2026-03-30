// models/Bike.ts
import mongoose from "mongoose";

const BikeSchema = new mongoose.Schema(
  {
    bikeNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    ownerName: {
      type: String,
    },
    phone: {
      type: String,
    },
    model: {
      type: String,
    },
  },
  { timestamps: true }
);

export default mongoose.models.Bike || mongoose.model("Bike", BikeSchema);