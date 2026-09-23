import { Router } from "express";
import { Employee } from "../models/Employee.js";
import { AttendanceLog } from "../models/AttendanceLog.js";
import { LeaveRequest } from "../models/LeaveRequest.js";
import { LeaveBalance } from "../models/LeaveBalance.js";
import { Announcement } from "../models/Announcement.js";
import { Asset } from "../models/Asset.js";
import { Device } from "../models/Device.js";
import { authRequired, adminRequired } from "../middleware/auth.js";
import { addDays, buildDailyRecords, buildWeekChart, classifyDay, currentWorkDate, FLAG_COLORS, formatDisplayDate, isWeekend, monthRange, punchesForWorkDate, todayStr } from "../utils/attendance.js";
import { buildEmployeeProjects, ensureEmployeeAssets } from "../utils/assets.js";
import { importEmployeesFromExcel, defaultRosterPath } from "../scripts/importEmployees.js";
import { getLastSync, refreshMachineCache } from "../services/zkMachines.js";

const router = Router();
router.use(authRequired, adminRequired);

const ROLE_GROSS = { Head: 180000, Manager: 120000, Member: 70000 };
const ROLE_SCORE = { Head: 90, Manager: 80, Member: 70 };

function to12h(time) {
  if (!time) return null;
  const [h, m, s] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, "0")}:${String(s || 0).padStart(2, "0")} ${ampm}`;
}

function monthKey(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  return iso.slice(0, 7);
}

function parseMonthDay(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  return { month: Number(iso.slice(5, 7)), day: Number(iso.slice(8, 10)), year: Number(iso.slice(0, 4)) };
}

/** Prefer source===roster employees (same filter as /admin/employees). */
async function loadRoster() {
  const filter = { $or: [{ source: "roster" }, { joiningDate: { $nin: ["", null] } }] };
  let employees = await Employee.find(filter).sort({ serialNo: 1, name: 1 }).lean();
  const rosterOnly = employees.filter((e) => e.source === "roster");
  if (rosterOnly.length) employees = rosterOnly;
  return employees;
}

function empLite(e) {
  return {
    empId: e.empId,
    name: e.name,
    jobTitle: e.jobTitle || "Employee",
    department: e.department || "-",
    team: e.team || "-",
    role: e.role || "Member",
    slot: e.slot || e.shift || "General",
  };
}

router.get("/employees", async (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  const department = String(req.query.department || "").trim();
  const team = String(req.query.team || "").trim();
  const filter = { $or: [{ source: "roster" }, { joiningDate: { $nin: ["", null] } }] };
  if (department) filter.department = department;
  if (team) filter.team = team;
  let employees = await Employee.find(filter).sort({ serialNo: 1, name: 1 }).lean();
  // Prefer true roster rows; if none yet, fall back to all
  const rosterOnly = employees.filter((e) => e.source === "roster");
  if (rosterOnly.length) employees = rosterOnly;
  if (q) {
    employees = employees.filter((e) => {
      const hay = [e.name, e.empId, e.email, e.jobTitle, e.department, e.team, e.mobile, e.cnicNo]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }
  const departments = [...new Set(employees.map((e) => e.department).filter(Boolean))].sort();
  const teams = [...new Set(employees.map((e) => e.team).filter(Boolean))].sort();
  res.json({ total: employees.length, employees, departments, teams });
});

router.post("/employees/import", async (_req, res) => {
  const result = await importEmployeesFromExcel(defaultRosterPath());
  res.json({ message: "Employees imported from roster", ...result });
});

router.get("/employees/meta", async (_req, res) => {
  const employees = await loadRoster();
  const last = await Employee.findOne().sort({ serialNo: -1 }).select("serialNo empId").lean();
  let nextEmpId = "500";
  const ids = employees.map((e) => Number(e.empId)).filter((n) => Number.isFinite(n));
  if (ids.length) nextEmpId = String(Math.max(...ids) + 1);
  res.json({
    nextEmpId,
    nextSerial: (last?.serialNo || employees.length || 0) + 1,
    departments: [...new Set(employees.map((e) => e.department).filter(Boolean))].sort(),
    teams: [...new Set(employees.map((e) => e.team).filter(Boolean))].sort(),
    roles: [...new Set(employees.map((e) => e.role).filter(Boolean))].sort(),
    slots: [...new Set(employees.map((e) => e.slot || e.shift).filter(Boolean))].sort(),
    reportsTo: [...new Set(employees.map((e) => e.reportsTo).filter((v) => v && v !== "-"))].sort(),
    assetTypes: ["laptop", "desktop", "monitor", "mouse", "keyboard", "headset", "phone", "idcard", "access", "other"],
  });
});

router.post("/employees", async (req, res) => {
  const body = req.body || {};
  const empId = String(body.empId || "").trim();
  const name = String(body.name || "").trim();
  if (!empId || !name) {
    return res.status(400).json({ message: "Employee code and name are required" });
  }

  const exists = await Employee.findOne({ empId }).lean();
  if (exists) return res.status(409).json({ message: `Employee ${empId} already exists` });

  const serialNo = Number(body.serialNo) || ((await Employee.countDocuments()) + 1);
  const employee = await Employee.create({
    empId,
    name,
    jobTitle: String(body.jobTitle || "Employee").trim(),
    department: String(body.department || "Operations").trim(),
    departmentFull: String(body.departmentFull || body.department || "").trim(),
    team: String(body.team || "General").trim(),
    reportsTo: String(body.reportsTo || "-").trim() || "-",
    role: String(body.role || "Member").trim(),
    shift: String(body.shift || body.slot || "General Shift").trim(),
    slot: String(body.slot || body.shift || "").trim(),
    maritalStatus: String(body.maritalStatus || "").trim(),
    gender: String(body.gender || "").trim(),
    dateOfBirth: String(body.dateOfBirth || "").trim(),
    cnicNo: String(body.cnicNo || "").trim(),
    religion: String(body.religion || "").trim(),
    email: String(body.email || "").trim().toLowerCase() || undefined,
    mobile: String(body.mobile || "").trim(),
    joiningDate: String(body.joiningDate || todayStr()).trim(),
    serialNo,
    source: "roster",
  });

  const bal = body.balances || {};
  await LeaveBalance.findOneAndUpdate(
    { empId },
    {
      empId,
      casual: Number(bal.casual ?? 6),
      annual: Number(bal.annual ?? 8),
      sick: Number(bal.sick ?? 6),
    },
    { upsert: true, new: true },
  );

  const assetRows = Array.isArray(body.assets) ? body.assets : [];
  const assignedBy = body.reportsTo && body.reportsTo !== "-" ? body.reportsTo : "Softnox IT";
  const createdAssets = [];
  for (let i = 0; i < assetRows.length; i += 1) {
    const a = assetRows[i] || {};
    const assetName = String(a.name || "").trim();
    if (!assetName) continue;
    const type = ["laptop", "desktop", "monitor", "mouse", "keyboard", "headset", "phone", "idcard", "access", "other"].includes(a.type)
      ? a.type
      : "other";
    const categoryCode = String(a.categoryCode || "AST-001").trim();
    const assetId = String(a.assetId || `${categoryCode.replace("-", "")}-${empId}${i + 1}`).trim();
    try {
      const doc = await Asset.create({
        empId,
        assetId,
        name: assetName.includes("#") ? assetName : `${assetName} - #${assetId}`,
        category: String(a.category || categoryCode.split("-")[0] || "AST"),
        categoryCode,
        type,
        assignedAt: a.assignedAt ? new Date(a.assignedAt) : new Date(),
        assignedBy: String(a.assignedBy || assignedBy).trim(),
        status: "assigned",
        notes: String(a.notes || "").trim(),
      });
      createdAssets.push(doc.toObject());
    } catch {
      // skip duplicate asset ids
    }
  }

  // If no assets were passed, seed Softnox default kit
  let assets = createdAssets;
  if (!assets.length) {
    assets = await ensureEmployeeAssets(employee.toObject());
  }

  res.status(201).json({
    message: "Employee created",
    employee: employee.toObject(),
    assets,
  });
});

router.get("/employees/:empId", async (req, res) => {
  const empId = String(req.params.empId).trim();
  const employee = await Employee.findOne({ empId }).lean();
  if (!employee) return res.status(404).json({ message: "Employee not found" });

  const [balance, leaveStats, recentLeaves, todayLogs, assets] = await Promise.all([
    LeaveBalance.findOne({ empId }).lean(),
    LeaveRequest.aggregate([
      { $match: { empId } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    LeaveRequest.find({ empId }).sort({ createdAt: -1 }).limit(8).lean(),
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
  const projects = buildEmployeeProjects(employee);

  res.json({
    employee,
    today: {
      date: today,
      ...todayClassified,
      checkInLabel: to12h(todayClassified.checkIn),
      checkOutLabel: to12h(todayClassified.checkOut),
    },
    balances: balance
      ? { casual: balance.casual, annual: balance.annual, sick: balance.sick }
      : { casual: 6, annual: 8, sick: 6 },
    leaveCounts: {
      pending: leaveCounts.pending || 0,
      approved: leaveCounts.approved || 0,
      rejected: leaveCounts.rejected || 0,
    },
    recentLeaves,
    assets,
    projects,
  });
});

router.get("/employees/:empId/attendance", async (req, res) => {
  const empId = String(req.params.empId).trim();
  const employee = await Employee.findOne({ empId }).lean();
  if (!employee) return res.status(404).json({ message: "Employee not found" });

  const now = new Date();
  let year = Number(req.query.year) || now.getFullYear();
  let month = req.query.month != null && req.query.month !== ""
    ? Number(req.query.month) - 1
    : now.getMonth();

  // Accept month=YYYY-MM from frontend
  const monthParam = String(req.query.month || "");
  if (/^\d{4}-\d{2}$/.test(monthParam)) {
    year = Number(monthParam.slice(0, 4));
    month = Number(monthParam.slice(5, 7)) - 1;
  }
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 0 || month > 11) {
    year = now.getFullYear();
    month = now.getMonth();
  }

  const dates = monthRange(year, month);
  const from = dates[0];
  const to = dates.at(-1);
  const today = currentWorkDate(now);

  const [logs, leaves] = await Promise.all([
    AttendanceLog.find({ empId, date: { $gte: addDays(from, -1), $lte: addDays(to, 1) } }).sort({ punchedAt: 1 }),
    LeaveRequest.find({
      empId,
      status: "approved",
      fromDate: { $lte: to },
      toDate: { $gte: from },
    }),
  ]);

  const leavesByDate = new Map();
  for (const leave of leaves) {
    for (const date of dates) {
      if (date >= leave.fromDate && date <= leave.toDate) leavesByDate.set(date, leave);
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
    punches: punchesForWorkDate(logs, today),
    leave: leavesByDate.get(today),
    date: today,
    empId,
  });

  const workDays = daily.filter((d) => d.status !== "OFF" && d.status !== "Schedule Days");
  const totalWorkHours = daily.reduce((sum, d) => sum + (d.hours || 0), 0);
  const scheduledHours = workDays.length * 9;
  const averageHours = workDays.length ? totalWorkHours / workDays.length : 0;
  const overtimeHours = daily.reduce((sum, d) => sum + Math.max(0, (d.hours || 0) - 9), 0);
  const breakHours = Number((workDays.length * 0.5).toFixed(2));
  const productiveHours = Number(Math.max(0, totalWorkHours - breakHours * (totalWorkHours > 0 ? 1 : 0) * 0.15).toFixed(2));

  const counts = daily.reduce((acc, day) => {
    acc[day.status] = (acc[day.status] || 0) + 1;
    return acc;
  }, {});

  const weekHours = daily
    .filter((d) => {
      const diff = (new Date(`${today}T12:00:00`) - new Date(`${d.date}T12:00:00`)) / 86400000;
      return diff >= 0 && diff < 7;
    })
    .reduce((s, d) => s + (d.hours || 0), 0);

  const pct = (value, target) => (target > 0 ? Number((((value - target) / target) * 100).toFixed(1)) : 0);

  // Productivity timeline segments for today's bar (06:00–20:00 window)
  const timeline = [];
  const dayStart = 6 * 60;
  const dayEnd = 20 * 60;
  if (todayRecord?.checkIn) {
    const [ih, im] = todayRecord.checkIn.split(":").map(Number);
    const inMin = ih * 60 + im;
    const outMin = todayRecord.checkOut
      ? (() => {
          const [oh, om] = todayRecord.checkOut.split(":").map(Number);
          return oh * 60 + om;
        })()
      : Math.min(dayEnd, Math.max(inMin + 30, now.getHours() * 60 + now.getMinutes()));

    const workSpan = Math.max(0, outMin - inMin);
    const otSpan = Math.max(0, outMin - (9 * 60 + 0) - inMin > 0 ? Math.max(0, outMin - (inMin + 9 * 60)) : 0);
    const productive = Math.max(0, workSpan - Math.min(60, Math.floor(workSpan * 0.08)) - otSpan);
    const brk = Math.min(60, Math.floor(workSpan * 0.08));

    if (inMin > dayStart) {
      timeline.push({ label: "Idle", type: "idle", minutes: inMin - dayStart });
    }
    if (productive > 0) timeline.push({ label: "Productive", type: "work", minutes: productive });
    if (brk > 0) timeline.push({ label: "Break", type: "break", minutes: brk });
    if (otSpan > 0) timeline.push({ label: "Overtime", type: "ot", minutes: otSpan });
    if (outMin < dayEnd) {
      timeline.push({ label: "Remaining", type: "idle", minutes: dayEnd - outMin });
    }
  } else {
    timeline.push({ label: "No punches", type: "idle", minutes: dayEnd - dayStart });
  }

  const rows = daily
    .filter((d) => d.date <= today || d.hours > 0 || ["Leave", "OFF"].includes(d.status))
    .map((d) => {
      const ot = Math.max(0, (d.hours || 0) - 9);
      const lateMins =
        d.checkIn && d.status === "Late"
          ? (() => {
              const [h, m] = d.checkIn.split(":").map(Number);
              return Math.max(0, h * 60 + m - (9 * 60 + 15));
            })()
          : 0;
      return {
        date: d.date,
        dateLabel: d.label || formatDisplayDate(d.date),
        label: d.label || formatDisplayDate(d.date),
        checkIn: d.checkIn,
        checkOut: d.checkOut,
        checkInLabel: to12h(d.checkIn),
        checkOutLabel: to12h(d.checkOut),
        status: d.status,
        hours: Number((d.hours || 0).toFixed(2)),
        breakLabel: d.hours > 0 ? "45 mins" : "0 mins",
        lateLabel: lateMins > 0 ? `${lateMins} mins` : "—",
        otLabel: ot > 0 ? `${ot.toFixed(2)} hrs` : "—",
        late: d.status === "Late",
        overtime: Number(ot.toFixed(2)),
        color: FLAG_COLORS[d.status] || "#90A4AE",
      };
    })
    .reverse();

  const recentLogs = await AttendanceLog.find({ empId }).sort({ punchedAt: -1 }).limit(40).lean();

  res.json({
    employee,
    year,
    month: month + 1,
    today: {
      ...todayRecord,
      date: today,
      displayDate: formatDisplayDate(today),
      checkInLabel: to12h(todayRecord.checkIn),
      checkOutLabel: to12h(todayRecord.checkOut),
    },
    kpis: {
      todayHours: Number((todayRecord.hours || 0).toFixed(2)),
      weekHours: Number(weekHours.toFixed(2)),
      monthHours: Number(totalWorkHours.toFixed(2)),
      otHours: Number(overtimeHours.toFixed(2)),
      overtimeHours: Number(overtimeHours.toFixed(2)),
      breakHours,
      productiveHours: Number((productiveHours || totalWorkHours).toFixed(2)),
      monthTarget: scheduledHours || 160,
      scheduledHours: Number(scheduledHours.toFixed(2)),
      averageHours: Number(averageHours.toFixed(2)),
      todayDelta: pct(todayRecord.hours || 0, 9),
      weekDelta: pct(weekHours, 40),
      monthDelta: pct(totalWorkHours, scheduledHours || 160),
      otDelta: pct(overtimeHours, 28),
      present: counts.Present || 0,
      late: counts.Late || 0,
      halfDay: (counts["Half Day"] || 0) + (counts["Short Day"] || 0),
      absent: counts.Absent || 0,
      leave: counts.Leave || 0,
      off: counts.OFF || 0,
    },
    timeline,
    rows,
    weekChart: buildWeekChart(daily),
    recentLogs: recentLogs.map((l) => ({
      ...l,
      timeLabel: to12h(l.time),
      typeLabel: l.type === 1 ? "Check In" : "Check Out",
    })),
  });
});

router.get("/dashboard", async (req, res) => {
  const date = req.query.date || todayStr();
  const [allEmployees, logs, leavePending] = await Promise.all([
    Employee.find().sort({ name: 1 }).lean(),
    AttendanceLog.find({ date: { $gte: addDays(date, -1), $lte: addDays(date, 1) } }).sort({ punchedAt: 1 }),
    LeaveRequest.countDocuments({ status: "pending" }),
  ]);

  const employees = (() => {
    const roster = allEmployees.filter((e) => e.source === "roster");
    return roster.length ? roster : allEmployees;
  })();
  const totalEmployees = employees.length;
  const empMap = new Map(allEmployees.map((e) => [e.empId, e]));
  const rosterIds = new Set(employees.map((e) => e.empId));

  const byEmp = new Map();
  for (const log of logs) {
    if (!byEmp.has(log.empId)) byEmp.set(log.empId, []);
    byEmp.get(log.empId).push(log);
  }

  let present = 0;
  let late = 0;
  let halfDay = 0;
  let absent = 0;
  const whosIn = [];
  const checkInMinutes = [];
  const workedHours = [];

  for (const [empId, empLogs] of byEmp.entries()) {
    const clean = punchesForWorkDate(empLogs, date);
    if (!clean.length) continue;
    const classified = classifyDay({ punches: empLogs, leave: null, date, empId });
    const emp = empMap.get(empId);
    const inRoster = rosterIds.has(empId);

    if (inRoster) {
      if (classified.status === "Present" || classified.status === "Early") present += 1;
      else if (classified.status === "Late") {
        late += 1;
        present += 1;
      } else if (classified.status === "Half Day" || classified.status === "Short Day") {
        halfDay += 1;
        present += 1;
      } else if (classified.status === "Absent") absent += 1;

      if (classified.checkIn) {
        const [h, m] = classified.checkIn.split(":").map(Number);
        checkInMinutes.push(h * 60 + m);
      }
      if (classified.hours) workedHours.push(classified.hours);
    }

    whosIn.push({
      empId,
      name: emp?.name || `Employee ${empId}`,
      department: emp?.department || "-",
      jobTitle: emp?.jobTitle || "Employee",
      checkIn: classified.checkIn,
      checkInLabel: to12h(classified.checkIn),
      status: classified.status === "Late" ? "Late" : classified.status === "Present" || classified.status === "Early" ? "Present" : classified.status,
      color: hashColor(empId),
    });
  }

  whosIn.sort((a, b) => String(a.checkIn || "").localeCompare(String(b.checkIn || "")));
  const punchedRoster = whosIn.filter((w) => rosterIds.has(w.empId));
  const rosterAbsent = Math.max(0, totalEmployees - punchedRoster.length);
  if (!absent) absent = rosterAbsent;

  const onLeave = await LeaveRequest.countDocuments({
    status: "approved",
    startDate: { $lte: date },
    endDate: { $gte: date },
  });

  const avgCheckIn = checkInMinutes.length
    ? (() => {
        const avg = Math.round(checkInMinutes.reduce((a, b) => a + b, 0) / checkInMinutes.length);
        const h = Math.floor(avg / 60);
        const m = avg % 60;
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      })()
    : "—";
  const avgHours = workedHours.length
    ? Number((workedHours.reduce((a, b) => a + b, 0) / workedHours.length).toFixed(1))
    : 0;
  const attendanceRate = totalEmployees
    ? Math.round((present / totalEmployees) * 1000) / 10
    : 0;

  const deptCounts = {};
  const roleCounts = {};
  const teamCounts = {};
  const genderCounts = {};
  const joinMonths = {};

  for (const e of employees) {
    const dept = e.department || "Other";
    deptCounts[dept] = (deptCounts[dept] || 0) + 1;
    const role = e.role || "Member";
    roleCounts[role] = (roleCounts[role] || 0) + 1;
    const team = e.team || "General";
    teamCounts[team] = (teamCounts[team] || 0) + 1;
    const gender = e.gender || "Unknown";
    genderCounts[gender] = (genderCounts[gender] || 0) + 1;
    const mk = monthKey(e.joiningDate);
    if (mk) joinMonths[mk] = (joinMonths[mk] || 0) + 1;
  }

  const byDepartment = Object.entries(deptCounts)
    .map(([name, count]) => ({
      name,
      count,
      pct: totalEmployees ? Math.round((count / totalEmployees) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const byRole = Object.entries(roleCounts).map(([name, value]) => ({
    name,
    value,
    color: name === "Head" ? "#2563eb" : name === "Manager" ? "#f59e0b" : "#22c55e",
  }));

  const byTeam = Object.entries(teamCounts).map(([name, value], i) => ({
    name,
    value,
    color: ["#2563eb", "#22c55e", "#f59e0b", "#a855f7", "#0ea5e9"][i % 5],
  }));

  // Cumulative headcount from joining dates (last 12 months + earlier bucket)
  const now = new Date(`${date}T12:00:00`);
  const headcountTrend = [];
  let running = employees.filter((e) => {
    const j = e.joiningDate;
    if (!j || !/^\d{4}-\d{2}-\d{2}/.test(j)) return true;
    return j < `${now.getFullYear() - 1}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  }).length;
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    running += joinMonths[key] || 0;
    headcountTrend.push({
      month: d.toLocaleString("en", { month: "short" }),
      value: running,
    });
  }

  const thisMonth = now.getMonth() + 1;
  const birthdays = employees
    .map((e) => {
      const dob = parseMonthDay(e.dateOfBirth);
      if (!dob || dob.month !== thisMonth) return null;
      return {
        name: e.name,
        empId: e.empId,
        date: `${String(dob.month).padStart(2, "0")}-${String(dob.day).padStart(2, "0")}`,
        label: new Date(2000, dob.month - 1, dob.day).toLocaleString("en", { month: "short", day: "numeric" }),
        color: hashColor(e.empId),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 12);

  const anniversaries = employees
    .map((e) => {
      const join = parseMonthDay(e.joiningDate);
      if (!join || join.month !== thisMonth) return null;
      const years = now.getFullYear() - join.year;
      if (years < 1) return null;
      return {
        type: "Work Anniversary",
        name: e.name,
        detail: `${e.name} · ${years} year${years > 1 ? "s" : ""}`,
        date: new Date(2000, join.month - 1, join.day).toLocaleString("en", { month: "short", day: "numeric" }),
        sort: `${String(join.month).padStart(2, "0")}-${String(join.day).padStart(2, "0")}`,
        tone: "amber",
      };
    })
    .filter(Boolean);

  const upcomingEvents = [
    ...anniversaries,
    ...birthdays.slice(0, 5).map((b) => ({
      type: "Birthday",
      name: b.name,
      detail: b.name,
      date: b.label,
      sort: b.date,
      tone: "purple",
    })),
  ]
    .sort((a, b) => a.sort.localeCompare(b.sort))
    .slice(0, 8);

  const thisMonthKey = `${now.getFullYear()}-${String(thisMonth).padStart(2, "0")}`;
  const newHires = employees.filter((e) => monthKey(e.joiningDate) === thisMonthKey).length;

  const employeeOptions = employees.map((e) => ({
    id: e.empId,
    name: e.name,
    role: e.jobTitle,
    dept: e.department,
    color: hashColor(e.empId),
  }));

  res.json({
    date,
    kpis: {
      totalEmployees,
      presentToday: present,
      absentToday: absent,
      onLeave,
      lateArrivals: late,
      halfDay,
      workFromHome: 0,
      newHires,
      exiting: 0,
      presentPct: totalEmployees ? Math.round((present / totalEmployees) * 1000) / 10 : 0,
      absentPct: totalEmployees ? Math.round((absent / totalEmployees) * 1000) / 10 : 0,
      leavePct: totalEmployees ? Math.round((onLeave / totalEmployees) * 1000) / 10 : 0,
      latePct: totalEmployees ? Math.round((late / totalEmployees) * 1000) / 10 : 0,
    },
    attendanceOverview: [
      { name: "Present", value: Math.max(present - late, 0), color: "#22c55e" },
      { name: "Absent", value: absent, color: "#ef4444" },
      { name: "On Leave", value: onLeave, color: "#f59e0b" },
      { name: "Late", value: late, color: "#fb923c" },
      { name: "Half Day", value: halfDay, color: "#a855f7" },
    ].filter((d) => d.value > 0),
    whosIn: whosIn.slice(0, 12),
    actionCenter: {
      count: leavePending + Math.max(0, late),
      items: [
        { count: leavePending, label: "Leave requests awaiting approval", tone: "red", to: "/admin/leaves" },
        { count: late, label: "Late arrivals today", tone: "orange", to: "/admin/attendance" },
        { count: newHires, label: "New hires this month", tone: "blue", to: "/admin/employees" },
        { count: birthdays.length, label: "Birthdays this month", tone: "purple" },
      ].filter((i) => i.count > 0),
    },
    workforce: {
      headcountTrend,
      byDepartment,
      byRole,
      byTeam,
    },
    productivity: {
      attendanceRate,
      avgCheckIn,
      avgHours,
      overtimeHours: 0,
    },
    birthdays,
    upcomingEvents,
    employeeOptions,
  });
});

function hashColor(id) {
  const palette = ["#2563eb", "#0f766e", "#7c3aed", "#db2777", "#d97706", "#0891b2", "#16a34a", "#ea580c"];
  let hash = 0;
  for (const ch of String(id)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length];
}

router.get("/attendance", async (req, res) => {
  const date = req.query.date || todayStr();
  const [logs, employees] = await Promise.all([
    AttendanceLog.find({ date: { $gte: addDays(date, -1), $lte: addDays(date, 1) } }).sort({ punchedAt: 1 }),
    Employee.find(),
  ]);
  const empMap = new Map(employees.map((e) => [e.empId, e]));
  const empIds = new Set(logs.map((l) => l.empId));
  const byEmp = new Map();
  for (const empId of empIds) byEmp.set(empId, []);
  for (const log of logs) {
    byEmp.get(log.empId).push(log);
  }

  const rows = [...byEmp.entries()]
    .map(([empId, empLogs]) => {
      const emp = empMap.get(empId);
      const clean = punchesForWorkDate(empLogs, date);
      const classified = classifyDay({
        punches: empLogs,
        leave: null,
        date,
        empId,
      });
      return {
        empId,
        name: emp?.name || `Employee ${empId}`,
        jobTitle: emp?.jobTitle || "Employee",
        department: emp?.department || "-",
        team: emp?.team || "-",
        role: emp?.role || "Member",
        slot: emp?.slot || emp?.shift || "",
        email: emp?.email || "",
        mobile: emp?.mobile || "",
        checkIn: classified.checkIn,
        checkOut: classified.checkOut,
        checkInLabel: to12h(classified.checkIn),
        checkOutLabel: to12h(classified.checkOut),
        hours: Number((classified.hours || 0).toFixed(2)),
        status: classified.status,
        punchCount: clean.length,
      };
    })
    .filter((row) => row.punchCount > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  res.json({ date, totalEmployees: rows.length, rows });
});

router.get("/attendance/logs", async (req, res) => {
  const date = req.query.date || todayStr();
  const filter = { date };
  if (req.query.empId) filter.empId = req.query.empId;
  const logs = await AttendanceLog.find(filter).sort({ punchedAt: 1 }).limit(2000);
  const empIds = [...new Set(logs.map((l) => l.empId))];
  const employees = await Employee.find({ empId: { $in: empIds } });
  const empMap = new Map(employees.map((e) => [e.empId, e]));
  res.json({
    date,
    logs: logs.map((l) => ({
      ...l.toObject(),
      employeeName: empMap.get(l.empId)?.name || l.empId,
      typeLabel: l.type === 1 ? "Check In" : "Check Out",
      timeLabel: to12h(l.time),
    })),
  });
});

router.get("/leaves", async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  const requests = await LeaveRequest.find(filter).sort({ createdAt: -1 }).limit(500);
  const empIds = [...new Set(requests.map((r) => r.empId))];
  const [employees, balances, countsAgg] = await Promise.all([
    Employee.find({ empId: { $in: empIds } }),
    LeaveBalance.find({ empId: { $in: empIds } }),
    LeaveRequest.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);
  const empMap = new Map(employees.map((e) => [e.empId, e]));
  const balMap = new Map(balances.map((b) => [b.empId, b]));
  const counts = { pending: 0, approved: 0, rejected: 0, total: 0 };
  for (const c of countsAgg) {
    counts[c._id] = c.count;
    counts.total += c.count;
  }
  res.json({
    counts,
    requests: requests.map((r) => {
      const emp = empMap.get(r.empId);
      const bal = balMap.get(r.empId);
      return {
        ...r.toObject(),
        employeeName: emp?.name || `Employee ${r.empId}`,
        jobTitle: emp?.jobTitle || "Employee",
        department: emp?.department || "—",
        team: emp?.team || "—",
        email: emp?.email || "",
        mobile: emp?.mobile || "",
        balances: bal
          ? { casual: bal.casual, annual: bal.annual, sick: bal.sick }
          : null,
      };
    }),
  });
});

router.get("/departments", async (_req, res) => {
  const employees = await loadRoster();
  const byDept = new Map();
  for (const e of employees) {
    const name = e.department || "Other";
    if (!byDept.has(name)) byDept.set(name, { name, employees: [], teams: new Set(), heads: [], managers: [] });
    const g = byDept.get(name);
    const lite = empLite(e);
    g.employees.push(lite);
    if (e.team) g.teams.add(e.team);
    const role = String(e.role || "").toLowerCase();
    if (role === "head") g.heads.push(lite);
    if (role === "manager") g.managers.push(lite);
  }
  const totalStaff = employees.length;
  const departments = [...byDept.values()]
    .map((d) => ({
      name: d.name,
      count: d.employees.length,
      pct: totalStaff ? Math.round((d.employees.length / totalStaff) * 1000) / 10 : 0,
      teams: [...d.teams].sort(),
      heads: d.heads,
      managers: d.managers,
      employees: d.employees.sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => b.count - a.count);
  res.json({
    total: departments.length,
    totalStaff,
    departments,
  });
});

router.get("/shifts", async (_req, res) => {
  const employees = await loadRoster();
  const bySlot = new Map();
  for (const e of employees) {
    const slot = e.slot || e.shift || "General Shift";
    if (!bySlot.has(slot)) bySlot.set(slot, []);
    bySlot.get(slot).push(empLite(e));
  }
  const shifts = [...bySlot.entries()]
    .map(([slot, list]) => ({
      slot,
      count: list.length,
      employees: list,
    }))
    .sort((a, b) => b.count - a.count);
  res.json({ total: shifts.length, shifts });
});

router.get("/roles", async (_req, res) => {
  const employees = await loadRoster();
  const order = ["Head", "Manager", "Member"];
  const byRole = new Map(order.map((r) => [r, []]));
  for (const e of employees) {
    const role = order.includes(e.role) ? e.role : "Member";
    byRole.get(role).push(empLite(e));
  }
  const roles = order.map((name) => ({
    name,
    count: byRole.get(name).length,
    employees: byRole.get(name),
  }));
  res.json({ total: employees.length, roles });
});

router.get("/reports", async (_req, res) => {
  const date = todayStr();
  const employees = await loadRoster();
  const totalEmployees = employees.length;

  const byDepartment = {};
  const byTeam = {};
  const byRole = {};
  for (const e of employees) {
    const dept = e.department || "Other";
    byDepartment[dept] = (byDepartment[dept] || 0) + 1;
    const team = e.team || "General";
    byTeam[team] = (byTeam[team] || 0) + 1;
    const role = e.role || "Member";
    byRole[role] = (byRole[role] || 0) + 1;
  }

  const [logs, leavePending] = await Promise.all([
    AttendanceLog.find({ date: { $gte: addDays(date, -1), $lte: addDays(date, 1) } }).sort({ punchedAt: 1 }),
    LeaveRequest.countDocuments({ status: "pending" }),
  ]);

  const rosterIds = new Set(employees.map((e) => e.empId));
  const byEmp = new Map();
  for (const log of logs) {
    if (!rosterIds.has(log.empId)) continue;
    if (!byEmp.has(log.empId)) byEmp.set(log.empId, []);
    byEmp.get(log.empId).push(log);
  }

  let present = 0;
  let late = 0;
  for (const [empId, empLogs] of byEmp.entries()) {
    const clean = punchesForWorkDate(empLogs, date);
    if (!clean.length) continue;
    const classified = classifyDay({ punches: empLogs, leave: null, date, empId });
    if (classified.status === "Late") {
      late += 1;
      present += 1;
    } else if (["Present", "Early", "Half Day", "Short Day"].includes(classified.status)) {
      present += 1;
    }
  }
  const absent = Math.max(0, totalEmployees - byEmp.size);

  const now = new Date(`${date}T12:00:00`);
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const newHiresThisMonth = employees.filter((e) => monthKey(e.joiningDate) === thisMonthKey).length;

  res.json({
    date,
    totalEmployees,
    byDepartment: Object.entries(byDepartment)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
    byTeam: Object.entries(byTeam)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
    byRole: Object.entries(byRole).map(([name, count]) => ({
      name,
      count,
      color: name === "Head" ? "#2563eb" : name === "Manager" ? "#f59e0b" : "#22c55e",
    })),
    attendance: { present, absent, late },
    leavePending,
    newHiresThisMonth,
  });
});

router.get("/documents", async (_req, res) => {
  const employees = await loadRoster();
  const rows = employees.map((e) => {
    const hasEmail = Boolean(e.email && String(e.email).trim());
    const hasCnic = Boolean(e.cnicNo && String(e.cnicNo).trim());
    const hasMobile = Boolean(e.mobile && String(e.mobile).trim());
    const hasDob = Boolean(e.dateOfBirth && String(e.dateOfBirth).trim());
    const missing = [];
    if (!hasEmail) missing.push("email");
    if (!hasCnic) missing.push("cnic");
    if (!hasMobile) missing.push("mobile");
    if (!hasDob) missing.push("dob");
    const score = Math.round(((4 - missing.length) / 4) * 100);
    return {
      empId: e.empId,
      name: e.name,
      department: e.department || "-",
      jobTitle: e.jobTitle || "Employee",
      hasEmail,
      hasCnic,
      hasMobile,
      hasDob,
      missing,
      score,
    };
  });
  rows.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));
  res.json({ total: rows.length, documents: rows });
});

router.post("/sync-leave-balances", async (_req, res) => {
  const { updateLeaveBalancesFromSheet } = await import("../scripts/updateLeaveBalances.js");
  const result = await updateLeaveBalancesFromSheet({ disconnect: false });
  res.json({ ok: true, ...result });
});

router.get("/payroll", async (_req, res) => {
  const employees = await loadRoster();
  const rows = employees.map((e) => {
    const role = e.role || "Member";
    const monthlyGross = ROLE_GROSS[role] || ROLE_GROSS.Member;
    return {
      empId: e.empId,
      name: e.name,
      department: e.department || "-",
      jobTitle: e.jobTitle || "Employee",
      team: e.team || "-",
      role,
      monthlyGross,
      estimate: true,
    };
  });
  const totalEstimate = rows.reduce((s, r) => s + r.monthlyGross, 0);
  res.json({
    note: "Monthly gross figures are role-based estimates, not actual payroll.",
    totalEmployees: rows.length,
    totalEstimate,
    payroll: rows,
  });
});

router.get("/performance", async (_req, res) => {
  const employees = await loadRoster();
  const rows = employees.map((e) => {
    const role = e.role || "Member";
    return {
      empId: e.empId,
      name: e.name,
      department: e.department || "-",
      jobTitle: e.jobTitle || "Employee",
      team: e.team || "-",
      role,
      score: ROLE_SCORE[role] || ROLE_SCORE.Member,
    };
  });
  rows.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  res.json({ total: rows.length, performance: rows });
});

router.get("/recruitment", async (_req, res) => {
  const employees = await loadRoster();
  const date = todayStr();
  const now = new Date(`${date}T12:00:00`);
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const ninetyAgo = new Date(now);
  ninetyAgo.setDate(ninetyAgo.getDate() - 90);
  const ninetyKey = `${ninetyAgo.getFullYear()}-${String(ninetyAgo.getMonth() + 1).padStart(2, "0")}-${String(ninetyAgo.getDate()).padStart(2, "0")}`;

  const mapHire = (e) => ({
    ...empLite(e),
    joiningDate: e.joiningDate,
    email: e.email || "",
    mobile: e.mobile || "",
  });

  const newHires = employees
    .filter((e) => monthKey(e.joiningDate) === thisMonthKey)
    .map(mapHire)
    .sort((a, b) => String(b.joiningDate).localeCompare(String(a.joiningDate)));

  const recentHires = employees
    .filter((e) => e.joiningDate && e.joiningDate >= ninetyKey)
    .map(mapHire)
    .sort((a, b) => String(b.joiningDate).localeCompare(String(a.joiningDate)))
    .slice(0, 40);

  const byDept = new Map();
  for (const e of employees) {
    const d = e.department || "Other";
    if (!byDept.has(d)) byDept.set(d, []);
    byDept.get(d).push(empLite(e));
  }

  const openRoles = [...byDept.entries()]
    .filter(([, list]) => list.length < 3)
    .map(([department, list]) => ({
      department,
      headcount: list.length,
      openings: Math.max(1, 3 - list.length),
      target: 3,
      status: "pipeline",
      employees: list,
      teams: [...new Set(list.map((e) => e.team).filter(Boolean))].sort(),
    }))
    .sort((a, b) => a.headcount - b.headcount || b.openings - a.openings);

  const totalOpenings = openRoles.reduce((s, r) => s + r.openings, 0);
  const depts = byDept.size;

  res.json({
    newHires,
    recentHires,
    openRoles,
    summary: {
      newHires: newHires.length,
      recentHires: recentHires.length,
      openRoles: openRoles.length,
      totalOpenings,
      totalStaff: employees.length,
      departments: depts,
    },
  });
});

router.get("/audit", async (_req, res) => {
  const [logs, leaves] = await Promise.all([
    AttendanceLog.find().sort({ punchedAt: -1 }).limit(50).lean(),
    LeaveRequest.find().sort({ updatedAt: -1 }).limit(30).lean(),
  ]);
  const empIds = [...new Set([...logs.map((l) => l.empId), ...leaves.map((l) => l.empId)])];
  const employees = await Employee.find({ empId: { $in: empIds } }).lean();
  const empMap = new Map(employees.map((e) => [e.empId, e]));

  res.json({
    attendance: logs.map((l) => ({
      empId: l.empId,
      employeeName: empMap.get(l.empId)?.name || `Employee ${l.empId}`,
      date: l.date,
      time: l.time,
      timeLabel: to12h(l.time),
      type: l.type,
      typeLabel: l.type === 1 ? "Check In" : "Check Out",
      source: l.source,
      punchedAt: l.punchedAt,
    })),
    leaves: leaves.map((r) => ({
      empId: r.empId,
      employeeName: empMap.get(r.empId)?.name || `Employee ${r.empId}`,
      type: r.type,
      status: r.status,
      fromDate: r.fromDate,
      toDate: r.toDate,
      days: r.days,
      updatedAt: r.updatedAt,
      createdAt: r.createdAt,
    })),
  });
});

router.get("/announcements", async (_req, res) => {
  let count = await Announcement.countDocuments();
  if (count === 0) {
    await Announcement.insertMany([
      {
        title: "Welcome to Softnox FlowHCM",
        body: "Use the admin console to manage roster, attendance, and leave for Softnox Technologies.",
        audience: "all",
        createdBy: "system",
      },
      {
        title: "Workday cutoff reminder",
        body: "Attendance is evaluated against the 08:00 Asia/Karachi workday cutoff. Please punch in on time.",
        audience: "employees",
        createdBy: "system",
      },
      {
        title: "Leave approvals",
        body: "Managers and admins: review pending leave requests regularly so balances stay accurate.",
        audience: "admin",
        createdBy: "system",
      },
    ]);
  }
  const announcements = await Announcement.find().sort({ createdAt: -1 }).limit(100).lean();
  res.json({ announcements });
});

router.post("/announcements", async (req, res) => {
  const title = String(req.body?.title || "").trim();
  const body = String(req.body?.body || "").trim();
  const audience = ["all", "employees", "admin"].includes(req.body?.audience) ? req.body.audience : "all";
  if (!title || !body) {
    return res.status(400).json({ message: "Title and body are required" });
  }
  const doc = await Announcement.create({
    title,
    body,
    audience,
    createdBy: req.user?.name || req.user?.email || "admin",
  });
  res.status(201).json({ announcement: doc });
});

router.get("/settings", async (_req, res) => {
  const employees = await loadRoster();
  const departments = new Set(employees.map((e) => e.department).filter(Boolean));
  const teams = new Set(employees.map((e) => e.team).filter(Boolean));
  res.json({
    companyName: "Softnox Technologies",
    timezone: "Asia/Karachi",
    workdayCutoff: "08:00",
    totalEmployees: employees.length,
    totalDepartments: departments.size,
    totalTeams: teams.size,
  });
});

router.get("/devices", async (_req, res) => {
  await refreshMachineCache();
  const devices = await Device.find().sort({ deviceId: 1 }).lean();
  const sync = getLastSync();
  const statusMap = new Map((sync.machines || []).map((m) => [String(m.id), m]));
  const rows = devices.map((d) => {
    const st = statusMap.get(String(d.deviceId));
    return {
      id: d._id,
      name: d.name,
      deviceId: d.deviceId,
      ip: d.ip,
      port: d.port,
      active: d.active !== false,
      lastOk: st?.ok ?? null,
      lastError: st?.error || null,
      lastLogs: st?.logs ?? null,
      updatedAt: d.updatedAt,
      createdAt: d.createdAt,
    };
  });
  res.json({
    total: rows.length,
    active: rows.filter((r) => r.active).length,
    inactive: rows.filter((r) => !r.active).length,
    lastSyncAt: sync.at,
    devices: rows,
  });
});

router.post("/devices", async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const deviceId = String(req.body?.deviceId || "").trim();
  const ip = String(req.body?.ip || "").trim();
  const port = Number(req.body?.port) || 4370;
  const active = req.body?.active !== false;
  if (!name || !deviceId || !ip) {
    return res.status(400).json({ message: "Name, device ID and IP are required" });
  }
  const exists = await Device.findOne({ deviceId });
  if (exists) return res.status(400).json({ message: "Device ID already exists" });
  const doc = await Device.create({ name, deviceId, ip, port, active });
  await refreshMachineCache();
  res.status(201).json({ device: doc });
});

router.put("/devices/:id", async (req, res) => {
  const doc = await Device.findById(req.params.id);
  if (!doc) return res.status(404).json({ message: "Device not found" });
  if (req.body?.name != null) doc.name = String(req.body.name).trim();
  if (req.body?.deviceId != null) doc.deviceId = String(req.body.deviceId).trim();
  if (req.body?.ip != null) doc.ip = String(req.body.ip).trim();
  if (req.body?.port != null) doc.port = Number(req.body.port) || 4370;
  if (req.body?.active != null) doc.active = Boolean(req.body.active);
  if (!doc.name || !doc.deviceId || !doc.ip) {
    return res.status(400).json({ message: "Name, device ID and IP are required" });
  }
  const clash = await Device.findOne({ deviceId: doc.deviceId, _id: { $ne: doc._id } });
  if (clash) return res.status(400).json({ message: "Device ID already exists" });
  await doc.save();
  await refreshMachineCache();
  res.json({ device: doc });
});

router.patch("/devices/:id/toggle", async (req, res) => {
  const doc = await Device.findById(req.params.id);
  if (!doc) return res.status(404).json({ message: "Device not found" });
  doc.active = !doc.active;
  await doc.save();
  await refreshMachineCache();
  res.json({ device: doc });
});

router.delete("/devices/:id", async (req, res) => {
  const doc = await Device.findByIdAndDelete(req.params.id);
  if (!doc) return res.status(404).json({ message: "Device not found" });
  await refreshMachineCache();
  res.json({ ok: true });
});

export default router;
