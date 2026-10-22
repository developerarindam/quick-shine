// models/LoginAttempt.ts — failed sign-ins per email / IP, used to slow down password guessing.
// Documents expire on their own (TTL index), so a lock lifts after the window.
import mongoose from "mongoose";

const LoginAttemptSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // "email:<address>" or "ip:<address>"
  count: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
});

LoginAttemptSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const LoginAttempt = mongoose.models.LoginAttempt || mongoose.model("LoginAttempt", LoginAttemptSchema);
export default LoginAttempt;
