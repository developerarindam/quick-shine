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

    // Price when taken together with any other service in the same job (e.g. Foam Wash ₹99 in a combo)
    comboPrice: {
      type: Number,
      min: 0,
    },

    category: {
      type: String,
      enum: ["basic", "premium", "addon"],
      default: "basic",
    },

    // Short code used in sheets, e.g. FW, CCL (matched when importing old data)
    code: {
      type: String,
      trim: true,
      uppercase: true,
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