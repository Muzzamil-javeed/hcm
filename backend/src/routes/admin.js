import { Router } from "express";
import { Employee } from "../models/Employee.js";
import { AttendanceLog } from "../models/AttendanceLog.js";
import { LeaveRequest } from "../models/LeaveRequest.js";
import { LeaveBalance } from "../models/LeaveBalance.js";
import { authRequired, adminRequired } from "../middleware/auth.js";
import { addDays, classifyDay, punchesForWorkDate, todayStr } from "../utils/attendance.js";

const router = Router();
router.use(authRequired, adminRequired);

function to12h(time) {
  if (!time) return null;
  const [h, m, s] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, "0")}:${String(s || 0).padStart(2, "0")} ${ampm}`;
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
  const [employees, balances] = await Promise.all([
    Employee.find({ empId: { $in: empIds } }),
    LeaveBalance.find({ empId: { $in: empIds } }),
  ]);
  const empMap = new Map(employees.map((e) => [e.empId, e]));
  const balMap = new Map(balances.map((b) => [b.empId, b]));
  res.json({
    requests: requests.map((r) => {
      const emp = empMap.get(r.empId);
      const bal = balMap.get(r.empId);
      return {
        ...r.toObject(),
        employeeName: emp?.name || `Employee ${r.empId}`,
        jobTitle: emp?.jobTitle || "Employee",
        balances: bal
          ? { casual: bal.casual, annual: bal.annual, sick: bal.sick }
          : null,
      };
    }),
  });
});

export default router;
