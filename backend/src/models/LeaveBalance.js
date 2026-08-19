import mongoose from "mongoose";

const leaveBalanceSchema = new mongoose.Schema(
  {
    empId: { type: String, required: true, unique: true, index: true },
    casual: { type: Number, default: 10 },
    annual: { type: Number, default: 14 },
    sick: { type: Number, default: 8 },
  },
  { timestamps: true }
);

export const LeaveBalance = mongoose.model("LeaveBalance", leaveBalanceSchema);
