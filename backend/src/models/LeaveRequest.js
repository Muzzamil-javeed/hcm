import mongoose from "mongoose";

const leaveRequestSchema = new mongoose.Schema(
  {
    empId: { type: String, required: true, index: true },
    type: {
      type: String,
      enum: ["casual", "annual", "sick", "unpaid"],
      required: true,
    },
    fromDate: { type: String, required: true },
    toDate: { type: String, required: true },
    days: { type: Number, required: true },
    duration: {
      type: String,
      enum: ["full", "half"],
      default: "full",
    },
    reason: { type: String, default: "" },
    attachmentName: { type: String, default: "" },
    attachmentMime: { type: String, default: "" },
    attachmentData: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "hr_approved", "approved", "rejected"],
      default: "pending",
    },
    hrApprovedBy: { type: String, default: "" },
    hrApprovedAt: { type: Date },
    adminApprovedBy: { type: String, default: "" },
  },
  { timestamps: true }
);

export const LeaveRequest = mongoose.model("LeaveRequest", leaveRequestSchema);
