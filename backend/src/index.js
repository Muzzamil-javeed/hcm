import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import session from "express-session";
import passport from "passport";
import { connectDb } from "./config/db.js";
import authRoutes, { setupPassport } from "./routes/auth.js";
import attendanceRoutes from "./routes/attendance.js";
import leaveRoutes from "./routes/leaves.js";
import dashboardRoutes from "./routes/dashboard.js";
import adminRoutes from "./routes/admin.js";
import { syncMachines } from "./services/zkMachines.js";

const app = express();
const PORT = Number(process.env.PORT) || 5050;

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json({ limit: "8mb" }));
app.use(cookieParser());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "flowhcm-session",
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.initialize());
setupPassport();

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "flowhcm-backend" });
});

app.use("/api/auth", authRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/admin", adminRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: err.message || "Server error" });
});

await connectDb(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/flowhcm");

{
  const { Employee } = await import("./models/Employee.js");
  const { AttendanceLog } = await import("./models/AttendanceLog.js");
  if ((await Employee.countDocuments()) === 0 && (await AttendanceLog.countDocuments()) === 0) {
    const { seedDatabase } = await import("./scripts/seed.js");
    await seedDatabase({ disconnect: false });
  }
  try {
    const { importEmployeesFromExcel, defaultRosterPath } = await import("./scripts/importEmployees.js");
    const roster = defaultRosterPath();
    const result = await importEmployeesFromExcel(roster);
    console.log(`Roster import: ${result.upserted} employees (total ${result.total})`);
    const { updateLeaveBalancesFromSheet } = await import("./scripts/updateLeaveBalances.js");
    const leaveResult = await updateLeaveBalancesFromSheet({ disconnect: false });
    console.log(
      `Leave sheet sync: matched ${leaveResult.matched}/${leaveResult.total} (special ${leaveResult.special})`
    );
  } catch (err) {
    console.warn("Roster import skipped:", err.message);
  }
}

export default app;

process.on("unhandledRejection", (err) => {
  console.error("unhandledRejection", err);
});

app.listen(PORT, () => {
  console.log(`Flow HCM API running on http://localhost:${PORT}`);
});

if (process.env.ZK_AUTO_SYNC !== "false") {
  const minutes = Number(process.env.ZK_SYNC_MINUTES) || 3;
  setTimeout(() => {
    syncMachines()
      .then((r) => console.log("ZK first sync", JSON.stringify(r.machines.map((m) => ({ id: m.id, ok: m.ok, logs: m.logs, error: m.error })))))
      .catch((err) => console.error("ZK first sync failed", err.message));
  }, 4000);
  setInterval(() => {
    syncMachines().catch((err) => console.error("ZK sync failed", err.message));
  }, minutes * 60 * 1000);
}
