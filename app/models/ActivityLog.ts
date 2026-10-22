// models/ActivityLog.ts — who did what, when (Super Admin only). Kept for a year.
import mongoose from "mongoose";

const ActivityLogSchema = new mongoose.Schema({
  at: { type: Date, default: Date.now },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  name: String, // snapshot, so the log still reads right after a rename / delete
  role: String,
  method: String, // POST / PUT / PATCH / DELETE, or LOGIN / LOGOUT
  path: String,
  status: Number,
  area: String, // jobs, money, team, stock, attendance, signin, settings
  action: String, // e.g. body.action for jobs ("pay", "status") or "login_failed"
  detail: mongoose.Schema.Types.Mixed, // request fields (passwords removed), trimmed
  result: mongoose.Schema.Types.Mixed, // a few identifying fields of what was created / changed
  ip: String,
  device: String,
});

ActivityLogSchema.index({ at: -1 });
ActivityLogSchema.index({ user: 1, at: -1 });
ActivityLogSchema.index({ at: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

const ActivityLog = mongoose.models.ActivityLog || mongoose.model("ActivityLog", ActivityLogSchema);
export default ActivityLog;
