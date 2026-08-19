import { Router } from "express";
import { LeaveBalance } from "../models/LeaveBalance.js";
import { LeaveRequest } from "../models/LeaveRequest.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();

function scopedEmpId(req) {
  if (req.user.empId === "ADMIN" && req.query.empId) return String(req.query.empId);
  return req.user.empId;
}

function countDays(fromDate, toDate) {
  const start = new Date(`${fromDate}T12:00:00`);
  const end = new Date(`${toDate}T12:00:00`);
  const diff = Math.floor((end - start) / 86400000) + 1;
  return Math.max(1, diff);
}

router.get("/balances", authRequired, async (req, res) => {
  const empId = scopedEmpId(req);
  const balance = await LeaveBalance.findOneAndUpdate(
    { empId },
    { $setOnInsert: { empId } },
    { upsert: true, new: true }
  );
  res.json({
    balances: [
      { type: "casual", label: "Casual Leaves", balance: balance.casual },
      { type: "annual", label: "Annual Leaves", balance: balance.annual },
      { type: "sick", label: "Sick Leave", balance: balance.sick },
    ],
  });
});

router.get("/", authRequired, async (req, res) => {
  const empId = scopedEmpId(req);
  const requests = await LeaveRequest.find({ empId }).sort({ createdAt: -1 });
  res.json({ requests });
});

router.post("/", authRequired, async (req, res) => {
  const { type, fromDate, toDate, reason } = req.body || {};
  if (!["casual", "annual", "sick"].includes(type)) {
    return res.status(400).json({ message: "Invalid leave type" });
  }
  if (!fromDate || !toDate) {
    return res.status(400).json({ message: "From and To dates are required" });
  }
  if (toDate < fromDate) {
    return res.status(400).json({ message: "To date cannot be before From date" });
  }
  const days = countDays(fromDate, toDate);
  const balance = await LeaveBalance.findOneAndUpdate(
    { empId: req.user.empId },
    { $setOnInsert: { empId: req.user.empId } },
    { upsert: true, new: true }
  );
  if (balance[type] < days) {
    return res.status(400).json({
      message: `Not enough ${type} leave. Available: ${balance[type].toFixed(2)}`,
    });
  }
  const request = await LeaveRequest.create({
    empId: req.user.empId,
    type,
    fromDate,
    toDate,
    days,
    reason: reason || "",
    status: "pending",
  });
  res.status(201).json({ request });
});

router.patch("/:id", authRequired, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Only admin can approve leaves" });
  }
  const { status } = req.body || {};
  if (!["approved", "rejected"].includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }
  const request = await LeaveRequest.findById(req.params.id);
  if (!request) return res.status(404).json({ message: "Request not found" });
  if (request.status !== "pending") {
    return res.status(400).json({ message: "Request already processed" });
  }
  request.status = status;
  await request.save();
  if (status === "approved") {
    await LeaveBalance.findOneAndUpdate(
      { empId: request.empId },
      { $inc: { [request.type]: -request.days } }
    );
  }
  res.json({ request });
});

export default router;
