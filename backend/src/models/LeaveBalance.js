import mongoose from "mongoose";

const leaveBalanceSchema = new mongoose.Schema(
  {
    empId: { type: String, required: true, unique: true, index: true },
    casual: { type: Number, default: 6 },
    annual: { type: Number, default: 8 },
    sick: { type: Number, default: 6 },
  },
  { timestamps: true }
);

export const LeaveBalance = mongoose.model("LeaveBalance", leaveBalanceSchema);
