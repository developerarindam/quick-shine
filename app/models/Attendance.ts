// models/Attendance.ts — one shift per employee per day
import mongoose from "mongoose";

const PunchSchema = new mongoose.Schema(
  {
    at: { type: Date, required: true },
    // where the phone was when punching (absent for entries made by the Super Admin)
    lat: Number,
    lng: Number,
    accuracy: Number,
    distance: Number, // metres from the shop
  },
  { _id: false }
);

const AttendanceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Studio-local calendar day, yyyy-mm-dd
    date: {
      type: String,
      required: true,
    },
    signIn: { type: PunchSchema, required: true },
    signOut: { type: PunchSchema },
    // set when the Super Admin adds or corrects the entry
    manual: { type: Boolean, default: false },
    editedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    editedAt: Date,
    note: { type: String, trim: true },
  },
  { timestamps: true }
);

AttendanceSchema.index({ user: 1, date: 1 }, { unique: true });
AttendanceSchema.index({ date: 1 });

export default mongoose.models.Attendance || mongoose.model("Attendance", AttendanceSchema);
