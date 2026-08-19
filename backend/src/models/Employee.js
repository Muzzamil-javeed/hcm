import mongoose from "mongoose";

const employeeSchema = new mongoose.Schema(
  {
    empId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    jobTitle: { type: String, default: "Employee" },
    department: { type: String, default: "Operations" },
    team: { type: String, default: "General" },
    reportsTo: { type: String, default: "-" },
    shift: { type: String, default: "General Shift" },
    email: String,
    avatar: String,
  },
  { timestamps: true }
);

export const Employee = mongoose.model("Employee", employeeSchema);
