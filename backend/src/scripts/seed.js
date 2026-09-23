import mongoose from "mongoose";
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { connectDb } from "../config/db.js";
import { Employee } from "../models/Employee.js";
import { AttendanceLog } from "../models/AttendanceLog.js";
import { LeaveBalance } from "../models/LeaveBalance.js";
import { LeaveRequest } from "../models/LeaveRequest.js";
import { User } from "../models/User.js";
import { monthRange, todayStr } from "../utils/attendance.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const KNOWN_EMPLOYEES = {
  112: { name: "Muzamil Javed", jobTitle: "Senior Frontend Specialist", department: "Engineering" },
  18: { name: "Ahmed Khan", jobTitle: "HR Executive", department: "HR" },
  20: { name: "Sara Malik", jobTitle: "Finance Officer", department: "Finance" },
  100: { name: "Usman Ali", jobTitle: "Team Lead", department: "Engineering" },
  104: { name: "Hina Sheikh", jobTitle: "QA Engineer", department: "Engineering" },
  116: { name: "Bilal Aslam", jobTitle: "Support Officer", department: "Support" },
  131: { name: "Fatima Noor", jobTitle: "Recruiter", department: "HR" },
  184: { name: "Hamza Qureshi", jobTitle: "Backend Developer", department: "Engineering" },
  187: { name: "Ayesha Raza", jobTitle: "UI Designer", department: "Design" },
  188: { name: "Omar Farooq", jobTitle: "Network Admin", department: "IT" },
  240: { name: "Nida Hassan", jobTitle: "Payroll Officer", department: "Finance" },
  252: { name: "Zainab Tariq", jobTitle: "HR Manager", department: "HR" },
  282: { name: "Ali Raza", jobTitle: "Software Engineer", department: "Engineering" },
  306: { name: "Sana Iqbal", jobTitle: "Accountant", department: "Finance" },
  350: { name: "Imran Shah", jobTitle: "Operations Lead", department: "Operations" },
  420: { name: "Maria Khan", jobTitle: "Admin Officer", department: "Admin" },
  444: { name: "Kashif Mehmood", jobTitle: "IT Support", department: "IT" },
  451: { name: "Rabia Anwar", jobTitle: "Content Writer", department: "Marketing" },
  502: { name: "Tariq Jameel", jobTitle: "Project Manager", department: "PMO" },
  506: { name: "Mehwish Ali", jobTitle: "Business Analyst", department: "PMO" },
  509: { name: "Shahzaib Nawaz", jobTitle: "DevOps Engineer", department: "Engineering" },
  526: { name: "Laiba Saeed", jobTitle: "Graphic Designer", department: "Design" },
  527: { name: "Hassan Javed", jobTitle: "Mobile Developer", department: "Engineering" },
  531: { name: "Iqra Bibi", jobTitle: "Customer Success", department: "Support" },
  542: { name: "Waleed Anjum", jobTitle: "Sales Executive", department: "Sales" },
  548: { name: "Noor Fatima", jobTitle: "Office Coordinator", department: "Admin" },
  561: { name: "Saad Rehman", jobTitle: "Data Analyst", department: "Analytics" },
  566: { name: "Maham Zafar", jobTitle: "HR Coordinator", department: "HR" },
  8000: { name: "Visitor Gate", jobTitle: "Device User", department: "Security" },
};

const FIRST_NAMES = [
  "Ahmed", "Ali", "Ayesha", "Bilal", "Fatima", "Hassan", "Hina", "Imran",
  "Iqra", "Kashif", "Laiba", "Maham", "Maria", "Mehwish", "Nida", "Noor",
  "Omar", "Rabia", "Saad", "Sana", "Sara", "Shahzaib", "Tariq", "Usman",
  "Waleed", "Zainab", "Hamza", "Sanaullah", "Komal", "Danish",
];
const LAST_NAMES = [
  "Khan", "Ali", "Malik", "Sheikh", "Raza", "Qureshi", "Hassan", "Tariq",
  "Shah", "Mehmood", "Anwar", "Jameel", "Nawaz", "Saeed", "Javed", "Rehman",
  "Zafar", "Farooq", "Iqbal", "Aslam",
];
const TITLES = [
  "Software Engineer", "HR Executive", "Accountant", "Support Officer",
  "Sales Executive", "QA Engineer", "Admin Officer", "Business Analyst",
];

function nameFor(empId) {
  if (KNOWN_EMPLOYEES[empId]) return KNOWN_EMPLOYEES[empId];
  const n = Number(empId) || empId.length;
  return {
    name: `${FIRST_NAMES[n % FIRST_NAMES.length]} ${LAST_NAMES[n % LAST_NAMES.length]}`,
    jobTitle: TITLES[n % TITLES.length],
    department: "Operations",
  };
}

function parseLogs(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 5) continue;
    const [empId, date, time, type, ip] = parts;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (!/^\d{2}:\d{2}:\d{2}$/.test(time)) continue;
    const punchType = Number(type);
    if (punchType !== 0 && punchType !== 1) continue;
    rows.push({
      empId: String(empId),
      date,
      time,
      type: punchType,
      ip,
      source: "device",
      punchedAt: new Date(`${date}T${time}`),
    });
  }
  return rows;
}

function shiftTime(time, minutes) {
  const [h, m, s] = time.split(":").map(Number);
  let total = h * 60 + m + minutes;
  total = ((total % 1440) + 1440) % 1440;
  const nh = Math.floor(total / 60);
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function expandMonth(realLogs) {
  const extra = [];
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const dates = monthRange(year, month).filter((d) => d < todayStr(now));
  const byEmp = new Map();
  for (const log of realLogs) {
    if (!byEmp.has(log.empId)) byEmp.set(log.empId, []);
    byEmp.get(log.empId).push(log);
  }

  const focusIds = new Set(["112", ...[...byEmp.keys()].slice(0, 25)]);

  for (const empId of focusIds) {
    const sample = (byEmp.get(empId) || []).sort((a, b) => a.time.localeCompare(b.time));
    const ins = sample.filter((l) => l.type === 1);
    const outs = sample.filter((l) => l.type === 0);
    const inTime = ins[0]?.time || "09:05:00";
    const outTime = outs.at(-1)?.time || "18:10:00";
    const ip = sample[0]?.ip || "192.168.0.12";

    for (const date of dates) {
      const day = new Date(`${date}T12:00:00`).getDay();
      if (day === 0 || day === 6) continue;
      if (empId === "112" && (date === "2026-08-14" || date === "2026-08-05")) continue;
      const roll = hash(`${empId}-${date}`) % 100;
      if (roll < 8) continue;
      const jitterIn = (hash(`${empId}-${date}-in`) % 50) - 10;
      const jitterOut = (hash(`${empId}-${date}-out`) % 40) - 15;
      extra.push({
        empId,
        date,
        time: shiftTime(inTime, jitterIn),
        type: 1,
        ip,
        source: "seed",
        punchedAt: new Date(`${date}T${shiftTime(inTime, jitterIn)}`),
      });
      extra.push({
        empId,
        date,
        time: shiftTime(outTime, jitterOut),
        type: 0,
        ip,
        source: "seed",
        punchedAt: new Date(`${date}T${shiftTime(outTime, jitterOut)}`),
      });
    }
  }
  return extra;
}

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

export async function seedDatabase({ disconnect = true } = {}) {
  if (mongoose.connection.readyState !== 1) {
    const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/flowhcm";
    await connectDb(uri);
  }

  const logFile = path.resolve(__dirname, "../../data/att-logs.txt");
  if (!fs.existsSync(logFile)) {
    throw new Error(`Log file not found at ${logFile}`);
  }

  const realLogs = parseLogs(logFile);
  console.log(`Parsed ${realLogs.length} punch rows`);
  const extra = expandMonth(realLogs);
  const allLogs = [...realLogs, ...extra];

  const empIds = [...new Set(allLogs.map((l) => l.empId))];
  const employees = empIds.map((empId) => {
    const info = nameFor(empId);
    return {
      empId,
      name: info.name,
      jobTitle: info.jobTitle,
      department: info.department,
      email: `${empId}@flowhcm.local`,
    };
  });

  await Promise.all([
    Employee.deleteMany({}),
    AttendanceLog.deleteMany({}),
    LeaveBalance.deleteMany({}),
    LeaveRequest.deleteMany({}),
    User.deleteMany({ email: /@flowhcm\.local$/ }),
  ]);

  await Employee.insertMany(employees);
  const chunk = 1000;
  for (let i = 0; i < allLogs.length; i += chunk) {
    await AttendanceLog.insertMany(allLogs.slice(i, i + chunk));
  }

  const balances = empIds.map((empId) => {
    return { empId, casual: 6, annual: 8, sick: 6 };
  });
  await LeaveBalance.insertMany(balances);

  await LeaveRequest.insertMany([
    {
      empId: "112",
      type: "sick",
      fromDate: "2026-08-05",
      toDate: "2026-08-05",
      days: 1,
      reason: "Fever",
      status: "approved",
    },
    {
      empId: "112",
      type: "casual",
      fromDate: "2026-08-21",
      toDate: "2026-08-21",
      days: 1,
      reason: "Personal work",
      status: "pending",
    },
  ]);

  await User.findOneAndUpdate(
    { email: "112@flowhcm.local" },
    {
      name: "Muzamil Javed",
      empId: "112",
      role: "admin",
      email: "112@flowhcm.local",
    },
    { upsert: true }
  );

  console.log(`Seeded ${employees.length} employees and ${allLogs.length} attendance punches`);
  if (disconnect) {
    await mongoose.disconnect();
  }
}

const invoked = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invoked && path.normalize(fileURLToPath(import.meta.url)) === path.normalize(invoked)) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
