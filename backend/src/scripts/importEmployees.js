import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import XLSX from "xlsx";
import { connectDb } from "../config/db.js";
import { Employee } from "../models/Employee.js";
import { LeaveBalance } from "../models/LeaveBalance.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function defaultRosterPath() {
  const candidates = [
    path.resolve(__dirname, "../../data/teams-data.xlsx"),
    path.resolve("C:/Users/Muzzamil Javeed/Downloads/Teams Data.xlsx"),
  ];
  return candidates.find((p) => fs.existsSync(p)) || candidates[0];
}

function excelToIso(value) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return "";
    return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }
  return String(value);
}

function deptLeaf(department) {
  const parts = String(department || "")
    .split(">")
    .map((s) => s.trim())
    .filter(Boolean);
  return parts[parts.length - 1] || "Other";
}

function cleanMobile(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function mapRosterRow(row) {
  const empId = String(row["Emp Code"] ?? row.empId ?? "").trim();
  if (!empId || empId === "undefined" || empId === "null") return null;
  const departmentFull = String(row.Department || "").trim();
  return {
    empId,
    serialNo: Number(row["S.No"]) || undefined,
    name: String(row.Name || `Employee ${empId}`).trim(),
    reportsTo: String(row["Reports To"] || "-").trim() || "-",
    role: String(row.Role || "Member").trim() || "Member",
    departmentFull,
    department: deptLeaf(departmentFull),
    jobTitle: String(row.Designation || "Employee").trim() || "Employee",
    team: String(row.Team || "General").trim() || "General",
    slot: String(row.Slot || "").trim(),
    shift: String(row.Slot || "General Shift").trim() || "General Shift",
    maritalStatus: String(row["Marital Status"] || "").trim(),
    gender: String(row.Gender || "").trim(),
    dateOfBirth: excelToIso(row["Date Of Birth"]),
    cnicNo: String(row["Cnic No"] || "").trim(),
    religion: String(row.Religion || "").trim(),
    email: String(row.Email || `${empId}@flowhcm.local`).trim().toLowerCase(),
    mobile: cleanMobile(row.Mobile),
    joiningDate: excelToIso(row["Joining Date"]),
    source: "roster",
  };
}

export async function importEmployeesFromExcel(filePath = defaultRosterPath(), { disconnect = false } = {}) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Roster file not found: ${filePath}`);
  }

  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  const mapped = rows.map(mapRosterRow).filter(Boolean);

  let upserted = 0;
  for (const emp of mapped) {
    await Employee.updateOne(
      { empId: emp.empId },
      { $set: emp },
      { upsert: true }
    );
    await LeaveBalance.findOneAndUpdate(
      { empId: emp.empId },
      { $setOnInsert: { empId: emp.empId, casual: 6, annual: 8, sick: 6 } },
      { upsert: true }
    );
    upserted += 1;
  }

  const total = await Employee.countDocuments();
  if (disconnect) await (await import("mongoose")).default.disconnect();
  return { filePath, rows: mapped.length, upserted, total };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await connectDb(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/flowhcm");
  const result = await importEmployeesFromExcel(process.argv[2] || defaultRosterPath(), { disconnect: true });
  console.log("Employee import complete", result);
}
