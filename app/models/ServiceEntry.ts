// models/ServiceEntry.ts
import mongoose from "mongoose";

const ServiceItemSchema = new mongoose.Schema({
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Service",
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
});

const ServiceEntrySchema = new mongoose.Schema(
  {
    bikeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bike",
      required: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    services: [ServiceItemSchema],

    subtotal: {
      type: Number,
      required: true,
    },
    discount: {
      type: Number,
      default: 0,
    },
    discountType: {
      type: String,
      enum: ["flat", "percent"],
      default: "flat",
    },
    total: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.models.ServiceEntry ||
  mongoose.model("ServiceEntry", ServiceEntrySchema);