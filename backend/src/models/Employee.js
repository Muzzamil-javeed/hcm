import mongoose from "mongoose";

const employeeSchema = new mongoose.Schema(
  {
    empId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    jobTitle: { type: String, default: "Employee" },
    department: { type: String, default: "Operations" },
    departmentFull: { type: String, default: "" },
    team: { type: String, default: "General" },
    reportsTo: { type: String, default: "-" },
    role: { type: String, default: "Member" },
    shift: { type: String, default: "General Shift" },
    slot: { type: String, default: "" },
    maritalStatus: { type: String, default: "" },
    gender: { type: String, default: "" },
    dateOfBirth: { type: String, default: "" },
    cnicNo: { type: String, default: "" },
    religion: { type: String, default: "" },
    email: String,
    mobile: { type: String, default: "" },
    joiningDate: { type: String, default: "" },
    serialNo: { type: Number },
    source: { type: String, default: "roster" },
    avatar: String,
  },
  { timestamps: true }
);

export const Employee = mongoose.model("Employee", employeeSchema);
