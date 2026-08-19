import mongoose from "mongoose";

const leaveRequestSchema = new mongoose.Schema(
  {
    empId: { type: String, required: true, index: true },
    type: {
      type: String,
      enum: ["casual", "annual", "sick"],
      required: true,
    },
    fromDate: { type: String, required: true },
    toDate: { type: String, required: true },
    days: { type: Number, required: true },
    reason: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
  },
  { timestamps: true }
);

export const LeaveRequest = mongoose.model("LeaveRequest", leaveRequestSchema);
