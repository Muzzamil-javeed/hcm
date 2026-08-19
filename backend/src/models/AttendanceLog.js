import mongoose from "mongoose";

const attendanceLogSchema = new mongoose.Schema(
  {
    empId: { type: String, required: true, index: true },
    date: { type: String, required: true, index: true },
    time: { type: String, required: true },
    type: { type: Number, enum: [0, 1], required: true },
    ip: String,
    machineId: String,
    source: { type: String, enum: ["device", "manual", "seed"], default: "device" },
    punchedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

attendanceLogSchema.index({ empId: 1, date: 1, punchedAt: 1 });

export const AttendanceLog = mongoose.model("AttendanceLog", attendanceLogSchema);
