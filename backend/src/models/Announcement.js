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
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const Announcement = mongoose.model("Announcement", announcementSchema);
