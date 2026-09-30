// models/StockMovement.ts — every change to an item's stock, for the audit trail
import mongoose from "mongoose";

export const MOVEMENT_TYPES = ["in", "out", "adjust", "job", "job_reversal"] as const;

const StockMovementSchema = new mongoose.Schema(
  {
    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InventoryItem",
      required: true,
      index: true,
    },
    // in = purchase/restock, out = manual use or wastage, adjust = stock count correction,
    // job = auto-used by a job's services, job_reversal = job deleted, stock returned
    type: {
      type: String,
      enum: MOVEMENT_TYPES,
      required: true,
    },
    // Signed change: positive adds stock, negative removes it
    qty: {
      type: Number,
      required: true,
    },
    balanceAfter: {
      type: Number,
    },
    unitCost: {
      type: Number,
    },
    note: {
      type: String,
      trim: true,
    },
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceEntry",
      index: true,
    },
    by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

StockMovementSchema.index({ item: 1, createdAt: -1 });

export default mongoose.models.StockMovement ||
  mongoose.model("StockMovement", StockMovementSchema);
