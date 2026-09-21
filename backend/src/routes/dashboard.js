import { Router } from "express";
import { Employee } from "../models/Employee.js";
import { AttendanceLog } from "../models/AttendanceLog.js";
import { LeaveRequest } from "../models/LeaveRequest.js";
import { LeaveBalance } from "../models/LeaveBalance.js";
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
} from "../utils/attendance.js";

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
  });
});

export default router;
