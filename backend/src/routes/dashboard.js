import { Router } from "express";
import { Employee } from "../models/Employee.js";
import { AttendanceLog } from "../models/AttendanceLog.js";
import { LeaveRequest } from "../models/LeaveRequest.js";
import { LeaveBalance } from "../models/LeaveBalance.js";
import { Announcement } from "../models/Announcement.js";
import { authRequired } from "../middleware/auth.js";
import {
  addDays,
  buildDailyRecords,
  buildWeekChart,
  classifyDay,
  currentWorkDate,
  FLAG_COLORS,
  formatDisplayDate,
  isWeekend,
  monthRange,
  todayStr,
} from "../utils/attendance.js";
import { ensureEmployeeAssets } from "../utils/assets.js";

const router = Router();

router.get("/employees", authRequired, async (_req, res) => {
  const employees = await Employee.find().sort({ empId: 1 });
  res.json({ employees });
});

router.get("/summary", authRequired, async (req, res) => {
  const empId =
    req.user.empId === "ADMIN" && req.query.empId ? req.query.empId : req.user.empId;
  const now = new Date();
  const year = Number(req.query.year) || now.getFullYear();
  const month = req.query.month ? Number(req.query.month) - 1 : now.getMonth();
  const dates = monthRange(year, month);
  const from = dates[0];
  const to = dates.at(-1);
  const today = currentWorkDate(now);

  const [employee, logs, leaves, balance] = await Promise.all([
    Employee.findOne({ empId }),
    AttendanceLog.find({ empId, date: { $gte: addDays(from, -1), $lte: addDays(to, 1) } }).sort({ punchedAt: 1 }),
    LeaveRequest.find({
      empId,
      status: "approved",
      fromDate: { $lte: to },
      toDate: { $gte: from },
    }),
    LeaveBalance.findOneAndUpdate(
      { empId },
      { $setOnInsert: { empId } },
      { upsert: true, new: true }
    ),
  ]);

  const leavesByDate = new Map();
  for (const leave of leaves) {
    for (const date of dates) {
      if (date >= leave.fromDate && date <= leave.toDate) {
        leavesByDate.set(date, leave);
      }
    }
  }

  const daily = buildDailyRecords(logs, leavesByDate, dates, now, employee?.shift, empId).map((d) => {
    if (isWeekend(d.date)) {
      return { ...d, status: "OFF", hours: 0, checkIn: null, checkOut: null, shiftName: "OFF" };
    }
    if (d.date > today && ["Absent", "Missing"].includes(d.status)) {
      return { ...d, status: "Schedule Days", hours: 0 };
    }
    return d;
  });
  const todayRecord = daily.find((d) => d.date === today) || classifyDay({
    punches: logs,
    leave: leavesByDate.get(today),
    date: today,
    empId,
  });

  const missing = daily
    .filter((d) => ["Absent", "Missing"].includes(d.status) && d.date <= today)
    .slice(-8)
    .reverse();

  const counts = daily.reduce((acc, day) => {
    acc[day.status] = (acc[day.status] || 0) + 1;
    return acc;
  }, {});

  const workDays = daily.filter((d) => d.status !== "OFF" && d.status !== "Schedule Days");
  const totalWorkHours = daily.reduce((sum, d) => sum + (d.hours || 0), 0);
  const scheduledHours = workDays.length * 9;
  const averageHours = workDays.length ? totalWorkHours / workDays.length : 0;

  const hoursChart = daily.map((d) => ({
    date: d.label,
    schedule: d.status === "OFF" ? 0 : 9,
    work: Number((d.hours || 0).toFixed(2)),
    average: Number(averageHours.toFixed(2)),
  }));

  const weekChart = buildWeekChart(daily);

  const flagChart = daily.map((d) => {
    const worked = Number((d.hours || 0).toFixed(2));
    const barHours =
      worked > 0 ? worked : ["OFF", "Schedule Days", "Absent", "Leave", "Missing"].includes(d.status) ? 2 : 0;
    return {
      date: d.label,
      fullDate: d.date,
      hours: worked,
      barHours,
      status: d.status,
      color: FLAG_COLORS[d.status] || "#90A4AE",
      checkIn: d.checkIn,
      checkOut: d.checkOut,
      shiftName: d.shiftName,
      scheduled: d.status === "OFF" || d.status === "Leave" || d.status === "Schedule Days" ? 0 : 9,
    };
  });

  const pendingLeaves = await LeaveRequest.countDocuments({ empId, status: "pending" });
  const recentLogs = await AttendanceLog.find({ empId }).sort({ punchedAt: -1 }).limit(25);

  const teamName = employee?.team || "General";
  const reportsToName = String(employee?.reportsTo || "").trim();
  const [announcements, teamMembers, managerByName] = await Promise.all([
    Announcement.find({ audience: { $in: ["all", "employees"] } })
      .sort({ createdAt: -1 })
      .limit(8)
      .lean(),
    Employee.find({
      team: teamName,
      empId: { $ne: empId },
      $or: [{ source: "roster" }, { joiningDate: { $nin: ["", null] } }],
    })
      .sort({ name: 1 })
      .limit(40)
      .select("empId name jobTitle department team role")
      .lean(),
    reportsToName && reportsToName !== "-"
      ? Employee.findOne({
          name: { $regex: `^${reportsToName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
        })
          .select("empId name jobTitle department team role")
          .lean()
      : Promise.resolve(null),
  ]);

  const isManagerRole = (role = "") => /manager|lead|head|director|supervisor/i.test(String(role));
  const mapPerson = (m) => ({
    empId: m.empId,
    name: m.name,
    jobTitle: m.jobTitle || "Employee",
    department: m.department || "—",
    role: m.role || "Member",
  });

  const managersMap = new Map();
  if (managerByName) managersMap.set(managerByName.empId, mapPerson(managerByName));
  for (const m of teamMembers) {
    if (isManagerRole(m.role)) managersMap.set(m.empId, mapPerson(m));
  }
  const managers = [...managersMap.values()].sort((a, b) => a.name.localeCompare(b.name));
  const managerIds = new Set(managers.map((m) => m.empId));
  const peers = teamMembers.filter((m) => !managerIds.has(m.empId)).slice(0, 24).map(mapPerson);

  res.json({
    employee: employee
      ? {
          ...employee.toObject(),
          team: employee.team || "Engineering",
          reportsTo: employee.reportsTo || "-",
          shift: todayRecord?.shiftName || "From punches",
        }
      : null,
    today: {
      ...todayRecord,
      date: today,
      displayDate: formatDisplayDate(today),
    },
    missing,
    balances: [
      { type: "casual", label: "Casual Leaves", balance: Number(balance.casual.toFixed(2)) },
      { type: "annual", label: "Annual Leaves", balance: Number(balance.annual.toFixed(2)) },
      { type: "sick", label: "Sick Leave", balance: Number(balance.sick.toFixed(2)) },
    ],
    requests: [
      { label: "Attendance Requests", value: missing.length },
      { label: "Exemption Requests", value: 3 },
      { label: "Adv Salary Requests", value: 0 },
      { label: "LeaveEncash Requests", value: pendingLeaves },
      { label: "OverTime Requests", value: 0 },
      { label: "Reimbursement", value: 0 },
      { label: "Loan Requests", value: 0 },
    ],
    summary: [
      { label: "Present", balance: counts.Present || 0 },
      { label: "Late", balance: counts.Late || 0 },
      { label: "Absent", balance: counts.Absent || 0 },
      { label: "Leave", balance: counts.Leave || 0 },
      { label: "OFF", balance: counts.OFF || 0 },
    ],
    flagChart,
    hoursChart,
    weekChart,
    totals: {
      scheduledHours: Number(scheduledHours.toFixed(2)),
      totalWorkHours: Number(totalWorkHours.toFixed(2)),
      averageHours: Number(averageHours.toFixed(2)),
    },
    payslip: {
      period: now.toLocaleString("en-US", { month: "long", year: "numeric" }),
      status: "Generated Payslip",
    },
    flagColors: FLAG_COLORS,
    recentLogs,
    announcements: announcements.map((a) => ({
      id: a._id,
      title: a.title,
      body: a.body,
      audience: a.audience,
      createdBy: a.createdBy,
      createdAt: a.createdAt,
    })),
    team: {
      name: teamName,
      members: peers,
      managers,
    },
  });
});

function to12h(time) {
  if (!time) return null;
  const [h, m, s] = String(time).split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, "0")}:${String(s || 0).padStart(2, "0")} ${ampm}`;
}

/** Logged-in employee: full profile + assets + leaves (read-only). */
router.get("/profile", authRequired, async (req, res) => {
  const empId = req.user.empId;
  if (!empId || empId === "ADMIN") {
    return res.status(400).json({ message: "Employee profile is only for staff accounts" });
  }

  const employee = await Employee.findOne({ empId }).lean();
  if (!employee) return res.status(404).json({ message: "Employee not found" });

  const [balance, leaveStats, recentLeaves, todayLogs, assets] = await Promise.all([
    LeaveBalance.findOneAndUpdate({ empId }, { $setOnInsert: { empId } }, { upsert: true, new: true }).lean(),
    LeaveRequest.aggregate([
      { $match: { empId } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    LeaveRequest.find({ empId }).sort({ createdAt: -1 }).limit(10).lean(),
    AttendanceLog.find({
      empId,
      date: { $gte: addDays(todayStr(), -1), $lte: addDays(todayStr(), 1) },
    })
      .sort({ punchedAt: 1 })
      .lean(),
    ensureEmployeeAssets(employee),
  ]);

  const today = todayStr();
  const todayClassified = classifyDay({
    punches: todayLogs,
    leave: null,
    date: today,
    empId,
  });
  const leaveCounts = Object.fromEntries(leaveStats.map((s) => [s._id, s.count]));

  res.json({
    employee,
    today: {
      date: today,
      displayDate: formatDisplayDate(today),
      ...todayClassified,
      checkInLabel: to12h(todayClassified.checkIn),
      checkOutLabel: to12h(todayClassified.checkOut),
    },
    balances: {
      casual: Number(balance?.casual ?? 6),
      annual: Number(balance?.annual ?? 8),
      sick: Number(balance?.sick ?? 6),
    },
    leaveCounts: {
      pending: leaveCounts.pending || 0,
      approved: leaveCounts.approved || 0,
      rejected: leaveCounts.rejected || 0,
    },
    recentLeaves,
    assets,
  });
});

router.get("/notifications", authRequired, async (req, res) => {
  const empId = req.user.empId;
  if (!empId || empId === "ADMIN") {
    return res.json({ notifications: [], unread: 0 });
  }

  const since = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);

  const [announcements, leaveDecisions] = await Promise.all([
    Announcement.find({
      audience: { $in: ["all", "employees"] },
      createdAt: { $gte: since },
    })
      .sort({ createdAt: -1 })
      .limit(12)
      .lean(),
    LeaveRequest.find({
      empId,
      status: { $in: ["approved", "rejected"] },
      updatedAt: { $gte: since },
    })
      .sort({ updatedAt: -1 })
      .limit(12)
      .lean(),
  ]);

  const notifications = [
    ...announcements.map((a) => ({
      id: `ann-${a._id}`,
      type: "announcement",
      tone: "blue",
      title: a.title || "New announcement",
      body: a.body || "A new Softnox announcement was posted.",
      at: a.createdAt,
    })),
    ...leaveDecisions.map((l) => {
      const approved = l.status === "approved";
      const typeLabel = String(l.type || "leave").replace(/^\w/, (c) => c.toUpperCase());
      return {
        id: `leave-${l._id}-${l.status}`,
        type: approved ? "leave_approved" : "leave_rejected",
        tone: approved ? "green" : "red",
        title: approved ? "Leave approved" : "Leave rejected",
        body: `Your ${typeLabel} leave (${l.fromDate} → ${l.toDate}) was ${l.status}.`,
        at: l.updatedAt || l.createdAt,
      };
    }),
  ]
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 20)
    .map((n) => ({
      ...n,
      at: n.at ? new Date(n.at).toISOString() : null,
    }));

  res.json({ notifications });
});

const ROLE_GROSS = { Head: 180000, Manager: 130000, Member: 70000 };

function monthLabel(year, monthIndex) {
  return new Date(year, monthIndex, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

function amountInWords(n) {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  function underThousand(num) {
    if (num < 20) return ones[num];
    if (num < 100) return `${tens[Math.floor(num / 10)]}${num % 10 ? ` ${ones[num % 10]}` : ""}`;
    return `${ones[Math.floor(num / 100)]} Hundred${num % 100 ? ` ${underThousand(num % 100)}` : ""}`;
  }
  const amount = Math.round(Number(n) || 0);
  if (!amount) return "Zero Only";
  const crore = Math.floor(amount / 10000000);
  const lakh = Math.floor((amount % 10000000) / 100000);
  const thousand = Math.floor((amount % 100000) / 1000);
  const rest = amount % 1000;
  const parts = [];
  if (crore) parts.push(`${underThousand(crore)} Crore`);
  if (lakh) parts.push(`${underThousand(lakh)} Lakh`);
  if (thousand) parts.push(`${underThousand(thousand)} Thousand`);
  if (rest) parts.push(underThousand(rest));
  return `${parts.join(" ")} Only`;
}

function buildPayslip(employee, balance, year, monthIndex, { expected = false } = {}) {
  const role = employee?.role || "Member";
  const monthly = ROLE_GROSS[role] || ROLE_GROSS.Member;
  const basic = Math.round(monthly * 0.9);
  const medical = monthly - basic;
  const eobi = 370;
  const iTax = Math.max(0, Math.round(monthly * 0.0195));
  const totalEarning = basic + medical;
  const totalDeduction = eobi + iTax;
  const net = totalEarning - totalDeduction;
  const periodKey = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
  const periodLabel = monthLabel(year, monthIndex);

  return {
    periodKey,
    periodLabel,
    expected,
    company: "Softnox Technologies (Pvt) Ltd",
    address: "Karachi, Pakistan",
    printDate: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    employee: {
      empId: employee?.empId || "—",
      name: employee?.name || "—",
      department: employee?.department || "—",
      departmentFull: employee?.departmentFull || employee?.department || "—",
      team: employee?.team || "—",
      jobTitle: employee?.jobTitle || "Employee",
      cnicNo: employee?.cnicNo || "—",
      joiningDate: employee?.joiningDate || "—",
      status: "Active",
      station: "Softnox HQ",
      monthlySalary: monthly,
    },
    earnings: [
      { label: "Basic Salary", amount: basic },
      { label: "Medical", amount: medical },
    ],
    deductions: [
      { label: "EOBI", amount: eobi },
      { label: "I Tax Amount", amount: iTax },
    ],
    totals: {
      earning: totalEarning,
      deduction: totalDeduction,
      net,
      taxPaidFiscal: iTax * Math.min(monthIndex + 1, 12),
      netWords: amountInWords(net),
    },
    leaveBalances: {
      casual: Number(balance?.casual ?? 6),
      annual: Number(balance?.annual ?? 8),
      sick: Number(balance?.sick ?? 6),
    },
    loanBalances: [{ label: "Soft Loan", amount: 0 }],
  };
}

router.get("/payslips", authRequired, async (req, res) => {
  const empId = req.user.empId;
  if (!empId || empId === "ADMIN") {
    return res.status(400).json({ message: "Payslips are only for staff accounts" });
  }

  const now = new Date();
  const periods = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const monthIndex = d.getMonth();
    const periodKey = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
    const expected = i === 0;
    periods.push({
      periodKey,
      label: `${d.toLocaleString("en-US", { month: "long" })} - ${year}`,
      expected,
      status: expected ? "Expected Payslip" : "View Payslip",
    });
  }

  res.json({ periods });
});

router.get("/payslips/:periodKey", authRequired, async (req, res) => {
  const empId = req.user.empId;
  if (!empId || empId === "ADMIN") {
    return res.status(400).json({ message: "Payslips are only for staff accounts" });
  }

  const match = String(req.params.periodKey || "").match(/^(\d{4})-(\d{2})$/);
  if (!match) return res.status(400).json({ message: "Invalid period" });
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) return res.status(400).json({ message: "Invalid period" });

  const now = new Date();
  const expected = year === now.getFullYear() && monthIndex === now.getMonth();

  const [employee, balance] = await Promise.all([
    Employee.findOne({ empId }),
    LeaveBalance.findOneAndUpdate(
      { empId },
      { $setOnInsert: { empId } },
      { upsert: true, new: true }
    ),
  ]);

  if (!employee) return res.status(404).json({ message: "Employee not found" });

  res.json({
    payslip: buildPayslip(employee, balance, year, monthIndex, { expected }),
  });
});

export default router;
