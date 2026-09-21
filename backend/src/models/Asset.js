import mongoose from "mongoose";

const assetSchema = new mongoose.Schema(
  {
    empId: { type: String, required: true, index: true },
    assetId: { type: String, required: true },
    name: { type: String, required: true },
    category: { type: String, default: "AST" },
    categoryCode: { type: String, default: "AST-001" },
    type: {
      type: String,
      enum: ["laptop", "desktop", "monitor", "mouse", "keyboard", "headset", "phone", "idcard", "access", "other"],
      default: "other",
    },
    assignedAt: { type: Date, default: Date.now },
    assignedBy: { type: String, default: "Softnox IT" },
    status: { type: String, enum: ["assigned", "returned", "repair"], default: "assigned" },
    notes: { type: String, default: "" },
  },
  { timestamps: true },
);

assetSchema.index({ empId: 1, assetId: 1 }, { unique: true });

export const Asset = mongoose.model("Asset", assetSchema);
