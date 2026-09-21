import mongoose from "mongoose";

const deviceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    deviceId: { type: String, required: true, trim: true, unique: true },
    ip: { type: String, required: true, trim: true },
    port: { type: Number, default: 4370 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Device = mongoose.model("Device", deviceSchema);
