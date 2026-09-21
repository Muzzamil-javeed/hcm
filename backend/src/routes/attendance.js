import { Router } from "express";
import { AttendanceLog } from "../models/AttendanceLog.js";
import { BreakLog } from "../models/BreakLog.js";
import { LeaveRequest } from "../models/LeaveRequest.js";
import { authRequired } from "../middleware/auth.js";
import { addDays, classifyDay, currentWorkDate, punchesForWorkDate, todayStr } from "../utils/attendance.js";
import { getLastSync, syncMachines } from "../services/zkMachines.js";

const router = Router();

function scopedEmpId(req) {
  if (req.user.empId === "ADMIN" && req.query.empId) return String(req.query.empId);
  return req.user.empId;
}

function nowParts(now = new Date()) {
  const date = todayStr(now);
  const time = now.toTimeString().slice(0, 8);
  return { date, time, punchedAt: now };
}

router.get("/today", authRequired, async (req, res) => {
  const empId = scopedEmpId(req);
  const date = currentWorkDate();
  const windowLogs = await AttendanceLog.find({
    empId,
    date: { $gte: date, $lte: addDays(date, 1) },
  }).sort({ punchedAt: 1 });
  const punches = punchesForWorkDate(windowLogs, date);
  const leave = await LeaveRequest.findOne({
    empId,
    status: "approved",
    fromDate: { $lte: date },
    toDate: { $gte: date },
  });
  const classified = classifyDay({
    punches: windowLogs,
    leave,
    date,
    empId,
  });
  const last = punches.at(-1);
  res.json({
    date,
    punches,
    ...classified,
    canCheckIn: !punches.some((p) => p.type === 1) || last?.type === 0,
    canCheckOut: last?.type === 1,
  });
});

router.post("/check-in", authRequired, async (req, res) => {
  const empId = req.user.empId;
  const { date, time, punchedAt } = nowParts();
  const workDate = currentWorkDate();
  const windowLogs = await AttendanceLog.find({
    empId,
    date: { $gte: workDate, $lte: addDays(workDate, 1) },
  }).sort({ punchedAt: 1 });
  const punches = punchesForWorkDate(windowLogs, workDate);
  const last = punches.at(-1);
  if (last?.type === 1) {
    return res.status(400).json({ message: "You are already checked in" });
  }
  const log = await AttendanceLog.create({
    empId,
    date,
    time,
    type: 1,
    ip: req.ip,
    source: "manual",
    punchedAt,
  });
  res.json({ log, message: `Checked in at ${time}` });
});

router.post("/check-out", authRequired, async (req, res) => {
  const empId = req.user.empId;
  const { date, time, punchedAt } = nowParts();
  const workDate = currentWorkDate();
  const windowLogs = await AttendanceLog.find({
    empId,
    date: { $gte: workDate, $lte: addDays(workDate, 1) },
  }).sort({ punchedAt: 1 });
  const punches = punchesForWorkDate(windowLogs, workDate);
  const last = punches.at(-1);
  if (!last || last.type !== 1) {
    return res.status(400).json({ message: "Check in first" });
  }
  const log = await AttendanceLog.create({
    empId,
    date,
    time,
    type: 0,
    ip: req.ip,
    source: "manual",
    punchedAt,
  });
  res.json({ log, message: `Checked out at ${time}` });
});

router.get("/logs", authRequired, async (req, res) => {
  const empId = scopedEmpId(req);
  const from = req.query.from;
  const to = req.query.to;
  const filter = { empId };
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = from;
    if (to) filter.date.$lte = to;
  }
  const logs = await AttendanceLog.find(filter).sort({ punchedAt: -1, time: -1 }).limit(2000);
  res.json({ logs });
});

router.get("/machines", authRequired, async (_req, res) => {
  res.json(getLastSync());
});

router.post("/sync", authRequired, async (_req, res) => {
  try {
    const result = await syncMachines();
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message || "Machine sync failed" });
  }
});

router.get("/breaks", authRequired, async (req, res) => {
  const empId = req.user.empId;
  const date = todayStr();
  const breaks = await BreakLog.find({ empId, date }).sort({ startedAt: 1 });
  const open = breaks.find((b) => !b.endedAt) || null;
  res.json({ date, breaks, open });
});

router.post("/breaks/start", authRequired, async (req, res) => {
  const empId = req.user.empId;
  const date = todayStr();
  const open = await BreakLog.findOne({ empId, date, endedAt: null });
  if (open) {
    return res.status(400).json({ message: "A break is already running" });
  }
  const row = await BreakLog.create({
    empId,
    date,
    type: req.body?.type || "Short Break",
    startedAt: new Date(),
  });
  res.json({ break: row });
});

router.post("/breaks/end", authRequired, async (req, res) => {
  const empId = req.user.empId;
  const date = todayStr();
  const open = await BreakLog.findOne({ empId, date, endedAt: null });
  if (!open) {
    return res.status(400).json({ message: "No active break" });
  }
  open.endedAt = new Date();
  await open.save();
  res.json({ break: open });
});

export default router;
