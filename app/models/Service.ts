// models/Service.ts
import mongoose from "mongoose";

const ServiceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    price: {
      type: Number,
      required: true,
    },

    category: {
      type: String,
      enum: ["basic", "premium", "addon"],
      default: "basic",
    },

    description: {
      type: String,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    duration: {
      type: Number, // in minutes (optional)
    },

    icon: {
      type: String, // for UI (optional)
    },

    // Inventory used each time this service is done — deducted automatically when a job is saved
    consumes: [
      {
        item: { type: mongoose.Schema.Types.ObjectId, ref: "InventoryItem", required: true },
        qty: { type: Number, required: true, min: 0 },
      },
    ],

    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Index for faster filtering
ServiceSchema.index({ isActive: 1, category: 1 });

export default mongoose.models.Service ||
  mongoose.model("Service", ServiceSchema);