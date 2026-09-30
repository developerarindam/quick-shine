// models/InventoryItem.ts — consumables and equipment the studio keeps in stock
import mongoose from "mongoose";

export const INVENTORY_CATEGORIES = ["shampoo", "polish", "coating", "cleaning", "tools", "accessories", "other"] as const;
export const INVENTORY_UNITS = ["ml", "L", "g", "kg", "pcs", "bottle", "can", "pack"] as const;

const InventoryItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: INVENTORY_CATEGORIES,
      default: "other",
    },
    unit: {
      type: String,
      enum: INVENTORY_UNITS,
      default: "pcs",
    },
    stock: {
      type: Number,
      default: 0,
    },
    // Reorder level — at or below this the item raises a low-stock alert
    minStock: {
      type: Number,
      default: 0,
      min: 0,
    },
    costPerUnit: {
      type: Number,
      min: 0,
    },
    supplier: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

InventoryItemSchema.index({ isActive: 1, name: 1 });

export default mongoose.models.InventoryItem ||
  mongoose.model("InventoryItem", InventoryItemSchema);
