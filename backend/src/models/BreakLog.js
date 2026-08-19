import mongoose from "mongoose";

const breakLogSchema = new mongoose.Schema(
  {
    empId: { type: String, required: true, index: true },
    date: { type: String, required: true, index: true },
    type: { type: String, default: "Short Break" },
    startedAt: { type: Date, required: true },
    endedAt: Date,
  },
  { timestamps: true }
);

export const BreakLog = mongoose.model("BreakLog", breakLogSchema);
