// models/ImportBatch.ts — one sheet upload (so it can be reviewed or undone)
import mongoose from "mongoose";

const ImportBatchSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    kind: { type: String, enum: ["jobs"], default: "jobs" },
    fileName: String,
    by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    rows: Number,
    jobs: Number,
    bikesCreated: Number,
    skipped: Number,
    cash: Number,
    online: Number,
    from: String, // first date in the sheet (yyyy-mm-dd)
    to: String,
    undoneAt: Date,
  },
  { timestamps: true }
);

export default mongoose.models.ImportBatch || mongoose.model("ImportBatch", ImportBatchSchema);
