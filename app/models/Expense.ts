// models/Expense.ts
import mongoose from "mongoose";

export const EXPENSE_CATEGORIES = [
  "supplies",
  "salary",
  "rent",
  "utilities",
  "equipment",
  "marketing",
  "other",
] as const;

const ExpenseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    category: {
      type: String,
      enum: EXPENSE_CATEGORIES,
      default: "other",
    },
    mode: {
      type: String,
      enum: ["cash", "online"],
      default: "cash",
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    note: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    // Whose money paid it: cash → that person's cash in hand; online → the online account holder.
    // Older expenses without it count against createdBy.
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    // Salary / wage payments: who was paid (links the expense to payroll)
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
  },
  { timestamps: true }
);

export default mongoose.models.Expense ||
  mongoose.model("Expense", ExpenseSchema);
