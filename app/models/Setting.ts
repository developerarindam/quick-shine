// models/Setting.ts — studio-wide settings, one document per key
import mongoose from "mongoose";

const SettingSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    value: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

const Setting = mongoose.models.Setting || mongoose.model("Setting", SettingSchema);

export async function getSetting<T>(key: string): Promise<T | null> {
  const doc = await Setting.findById(key).lean<{ value: T }>();
  return doc?.value ?? null;
}

export async function setSetting<T>(key: string, value: T) {
  await Setting.updateOne({ _id: key }, { $set: { value } }, { upsert: true });
}

export default Setting;
