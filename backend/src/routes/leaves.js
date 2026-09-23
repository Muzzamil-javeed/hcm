import { Router } from "express";
import { LeaveBalance } from "../models/LeaveBalance.js";
import { LeaveRequest } from "../models/LeaveRequest.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();

function scopedEmpId(req) {
  if (req.user.empId === "ADMIN" && req.query.empId) return String(req.query.empId);
  return req.user.empId;
}

const DOC_PREFIXES = ["data:image/jpeg", "data:image/png", "data:image/webp", "data:application/pdf"];

function readAttachment(body) {
  const name = String(body?.attachmentName || "").trim().slice(0, 180);
  const data = String(body?.attachmentData || "");
  if (!name && !data) return { attachmentName: "", attachmentMime: "", attachmentData: "" };
  if (!name || !data.startsWith("data:") || data.length > 2_200_000) {
    return { error: "Document must be a JPG, PNG, WEBP, or PDF under 1.5 MB" };
  }
  if (!DOC_PREFIXES.some((prefix) => data.startsWith(prefix))) {
    return { error: "Document must be a JPG, PNG, WEBP, or PDF" };
  }
  const mime = data.slice(5, data.indexOf(";")) || "";
  return { attachmentName: name, attachmentMime: mime, attachmentData: data };
}

function countDays(fromDate, toDate, duration = "full") {
  const start = new Date(`${fromDate}T12:00:00`);
  const end = new Date(`${toDate}T12:00:00`);
  const diff = Math.floor((end - start) / 86400000) + 1;
  const days = Math.max(1, diff);
  if (duration === "half") return Math.max(0.5, days * 0.5);
  return days;
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
      { type: "unpaid", label: "Unpaid Leave", balance: null },
    ],
  });
});

router.get("/", authRequired, async (req, res) => {
  const empId = scopedEmpId(req);
  const requests = await LeaveRequest.find({ empId }).select("-attachmentData").sort({ createdAt: -1 });
  res.json({ requests });
});

router.post("/", authRequired, async (req, res) => {
  const { type, fromDate, toDate, reason, duration } = req.body || {};
  if (!["casual", "annual", "sick", "unpaid"].includes(type)) {
    return res.status(400).json({ message: "Invalid leave type" });
  }
  if (!fromDate || !toDate) {
    return res.status(400).json({ message: "From and To dates are required" });
  }
  if (toDate < fromDate) {
    return res.status(400).json({ message: "To date cannot be before From date" });
  }
  const leaveDuration = duration === "half" ? "half" : "full";
  const days = countDays(fromDate, toDate, leaveDuration);
  const attachment = readAttachment(req.body);
  if (attachment.error) return res.status(400).json({ message: attachment.error });

  if (type !== "unpaid") {
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
  }

  const request = await LeaveRequest.create({
    empId: req.user.empId,
    type,
    fromDate,
    toDate,
    days,
    duration: leaveDuration,
    reason: reason || "",
    attachmentName: attachment.attachmentName,
    attachmentMime: attachment.attachmentMime,
    attachmentData: attachment.attachmentData,
    status: "pending",
  });
  res.status(201).json({ request });
});

router.get("/:id", authRequired, async (req, res) => {
  if (req.user.role !== "hr" && req.user.role !== "admin") {
    return res.status(403).json({ message: "Only HR or Admin can open leave details" });
  }
  const request = await LeaveRequest.findById(req.params.id).select("attachmentName attachmentMime attachmentData");
  if (!request) return res.status(404).json({ message: "Request not found" });
  res.json({
    attachmentName: request.attachmentName || "",
    attachmentMime: request.attachmentMime || "",
    attachmentData: request.attachmentData || "",
  });
});

router.patch("/:id", authRequired, async (req, res) => {
  const role = req.user.role;
  if (role !== "hr" && role !== "admin") {
    return res.status(403).json({ message: "Only HR or Admin can review leaves" });
  }
  const { status } = req.body || {};
  if (!["approved", "rejected"].includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }
  const request = await LeaveRequest.findById(req.params.id);
  if (!request) return res.status(404).json({ message: "Request not found" });

  if (status === "rejected") {
    const hrCanReject = role === "hr" && request.status === "pending";
    const adminCanReject = role === "admin" && request.status === "hr_approved";
    if (!hrCanReject && !adminCanReject) {
      return res.status(400).json({ message: "This request is not waiting for you" });
    }
    request.status = "rejected";
    await request.save();
    return res.json({ request });
  }

  if (role === "hr") {
    if (request.status !== "pending") {
      return res.status(400).json({ message: "HR can only approve a new request" });
    }
    request.status = "hr_approved";
    request.hrApprovedBy = req.user.name || "HR";
    request.hrApprovedAt = new Date();
    await request.save();
    return res.json({ request });
  }

  if (request.status !== "hr_approved") {
    return res.status(400).json({ message: "Admin approves only after HR has approved" });
  }
  request.status = "approved";
  request.adminApprovedBy = req.user.name || "Admin";
  await request.save();
  if (request.type !== "unpaid") {
    await LeaveBalance.findOneAndUpdate(
      { empId: request.empId },
      { $inc: { [request.type]: -request.days } }
    );
  }
  res.json({ request });
});

export default router;
