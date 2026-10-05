// models/CashHandover.ts — an employee handing collected cash to a Super Admin / Admin
import mongoose from "mongoose";

const CashHandoverSchema = new mongoose.Schema(
  {
    from: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    note: {
      type: String,
      trim: true,
    },
    // pending → approved (cash now with `to`) | rejected | cancelled (by the sender)
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled"],
      default: "pending",
      index: true,
    },
    // The approver — approving means they have received the cash
    to: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    decidedAt: Date,
    reason: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

export default mongoose.models.CashHandover ||
  mongoose.model("CashHandover", CashHandoverSchema);
