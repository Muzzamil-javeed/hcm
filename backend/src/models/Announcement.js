import mongoose from "mongoose";

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    audience: {
      type: String,
      enum: ["all", "employees", "admin"],
      default: "all",
    },
    createdBy: { type: String, default: "admin" },
    startDate: { type: String, default: "" },
    endDate: { type: String, default: "" },
    documentName: { type: String, default: "" },
    documentData: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const Announcement = mongoose.model("Announcement", announcementSchema);

export function todayKey() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" });
}

export function readAnnouncementWindow(body) {
  const startDate = String(body?.startDate || "").trim();
  const endDate = String(body?.endDate || "").trim();
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (!startDate || !endDate) return { error: "Show from and show until dates are required" };
  if (!iso.test(startDate) || !iso.test(endDate)) return { error: "Use a valid date range" };
  if (endDate < startDate) return { error: "End date cannot be before the start date" };
  return { startDate, endDate };
}

export function activeWindowFilter(today = todayKey()) {
  return {
    $and: [
      { $or: [{ startDate: { $in: ["", null] } }, { startDate: { $exists: false } }, { startDate: { $lte: today } }] },
      { $or: [{ endDate: { $in: ["", null] } }, { endDate: { $exists: false } }, { endDate: { $gte: today } }] },
    ],
  };
}

export async function purgeExpiredAnnouncements() {
  const today = todayKey();
  await Announcement.deleteMany({ endDate: { $nin: ["", null], $lt: today } });
  return today;
}

export function readAnnouncementPdf(body) {
  const name = String(body?.documentName || "").trim().slice(0, 180);
  const data = String(body?.documentData || "");
  if (!name && !data) return { documentName: "", documentData: "" };
  if (!name || !data.startsWith("data:application/pdf")) {
    return { error: "Only a PDF can be attached" };
  }
  if (data.length > 6_000_000) return { error: "PDF must be under 4 MB" };
  return { documentName: name, documentData: data };
}

export function announcementNotifAt(row) {
  const created = row.createdAt ? new Date(row.createdAt) : new Date();
  if (!row.startDate) return created;
  const start = new Date(`${row.startDate}T00:00:00+05:00`);
  return start > created ? start : created;
}
