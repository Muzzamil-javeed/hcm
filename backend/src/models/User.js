import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    googleId: { type: String, index: true, sparse: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    name: { type: String, required: true },
    picture: String,
    empId: { type: String, index: true },
    role: { type: String, enum: ["employee", "hr", "admin"], default: "employee" },
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);
