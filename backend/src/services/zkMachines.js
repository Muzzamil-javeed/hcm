import { createRequire } from "module";
import { AttendanceLog } from "../models/AttendanceLog.js";
import { Employee } from "../models/Employee.js";
import { LeaveBalance } from "../models/LeaveBalance.js";
import { todayStr } from "../utils/attendance.js";

const require = createRequire(import.meta.url);
const ZKLib = require("node-zklib");

const DEFAULT_MACHINES = [
  { id: "201", ip: "192.168.0.12", port: 4370 },
  { id: "203", ip: "192.168.0.11", port: 4370 },
];

export function getMachines() {
  const raw = process.env.ZK_MACHINES;
  if (!raw) return DEFAULT_MACHINES;
  return raw.split(",").map((entry, i) => {
    const parts = entry.trim().split(":");
    if (parts.length === 3) {
      return { id: parts[0], ip: parts[1], port: Number(parts[2]) || 4370 };
    }
    if (parts.length === 2) {
      return { id: String(201 + i), ip: parts[0], port: Number(parts[1]) || 4370 };
    }
    return { id: String(201 + i), ip: parts[0], port: 4370 };
  });
}

let lastSync = {
  at: null,
  machines: getMachines().map((m) => ({ ...m, ok: false, logs: 0, users: 0, error: "Not synced yet" })),
};

export function getLastSync() {
  return lastSync;
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function localParts(date) {
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  return { date: `${y}-${m}-${d}`, time, punchedAt: new Date(date.getTime()) };
}

function recordUserId(row) {
  const id = row.deviceUserId ?? row.userId ?? row.uid ?? row.user_id ?? row.id ?? row.userSn;
  if (id === undefined || id === null || id === "") return null;
  return String(id).trim();
}

function recordTime(row) {
  const raw = row.recordTime || row.attTime || row.timestamp || row.time;
  if (!raw) return null;
  const d = raw instanceof Date ? raw : new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeRows(rows, machine) {
  const parsed = [];
  for (const row of rows || []) {
    const empId = recordUserId(row);
    const punchedAt = recordTime(row);
    if (!empId || !punchedAt) continue;
    punchedAt.setMilliseconds(0);
    parsed.push({ empId, punchedAt, machine });
  }
  parsed.sort((a, b) => a.empId.localeCompare(b.empId) || a.punchedAt - b.punchedAt);

  const byDay = new Map();
  for (const row of parsed) {
    const key = `${row.empId}-${todayStr(row.punchedAt)}`;
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(row);
  }

  const result = [];
  for (const group of byDay.values()) {
    group.forEach((row, i) => {
      let type = 1;
      if (group.length === 1) type = 1;
      else if (i === 0) type = 1;
      else if (i === group.length - 1) type = 0;
      else type = i % 2 === 0 ? 1 : 0;
      const parts = localParts(row.punchedAt);
      result.push({
        empId: row.empId,
        date: parts.date,
        time: parts.time,
        type,
        ip: row.machine.ip,
        machineId: row.machine.id,
        source: "device",
        punchedAt: parts.punchedAt,
      });
    });
  }
  return result;
}

async function pullMachine(machine) {
  const timeout = Number(process.env.ZK_TIMEOUT) || 20000;
  const commKey = Number(process.env.ZK_COMM_KEY) || 0;
  const zk = new ZKLib(machine.ip, machine.port, timeout, 4000 + Number(machine.id || 0), commKey, "tcp");
  const result = {
    id: machine.id,
    ip: machine.ip,
    port: machine.port,
    ok: false,
    logs: 0,
    users: 0,
    saved: 0,
    error: null,
  };

  try {
    await zk.createSocket();
    let users = [];
    try {
      const userRes = await zk.getUsers();
      users = Array.isArray(userRes) ? userRes : userRes?.data || [];
      result.users = users.length;
    } catch {
      users = [];
    }

    const logRes = await zk.getAttendances();
    const rows = Array.isArray(logRes) ? logRes : logRes?.data || [];
    result.logs = rows.length;
    const punches = normalizeRows(rows, machine);
    result.saved = await savePunches(punches);
    try {
      await upsertEmployees(users, punches);
    } catch (err) {
      console.error(`Employee upsert failed for machine ${machine.id}:`, err.message);
    }
    result.ok = true;
  } catch (err) {
    result.error = err.message || String(err);
  } finally {
    try {
      await zk.disconnect();
    } catch {
      // ignore
    }
  }
  return result;
}

async function savePunches(punches) {
  if (!punches.length) return 0;
  let saved = 0;
  const chunkSize = 1000;
  for (let i = 0; i < punches.length; i += chunkSize) {
    const chunk = punches.slice(i, i + chunkSize);
    try {
      const res = await AttendanceLog.bulkWrite(
        chunk.map((punch) => ({
          updateOne: {
            filter: { empId: punch.empId, punchedAt: punch.punchedAt },
            update: { $setOnInsert: punch },
            upsert: true,
          },
        })),
        { ordered: false }
      );
      saved += res.upsertedCount || 0;
    } catch (err) {
      saved += err.result?.nUpserted || err.insertedCount || 0;
    }
  }
  return saved;
}

async function upsertEmployees(users, punches) {
  const fromDevice = new Map();
  for (const user of users || []) {
    const empId = String(user.userId || user.uid || user.userid || user.deviceUserId || "").trim();
    if (!empId) continue;
    fromDevice.set(empId, user.name || user.username || `Employee ${empId}`);
  }
  const ids = new Set([...fromDevice.keys(), ...punches.map((p) => p.empId)]);
  for (const empId of ids) {
    const deviceName = fromDevice.get(empId);
    const name = empId === "112" ? "Muzamil Javed" : deviceName || `Employee ${empId}`;
    await Employee.updateOne(
      { empId },
      {
        $set: { name },
        $setOnInsert: {
          empId,
          jobTitle: empId === "112" ? "Senior Frontend Specialist" : "Employee",
          department: empId === "112" ? "Engineering" : "Operations",
          email: `${empId}@flowhcm.local`,
        },
      },
      { upsert: true }
    );
    await LeaveBalance.findOneAndUpdate(
      { empId },
      { $setOnInsert: { empId, casual: 10, annual: 14, sick: 8 } },
      { upsert: true }
    );
  }
}

export async function syncMachines() {
  const machines = getMachines();
  const reports = [];
  for (const machine of machines) {
    reports.push(await pullMachine(machine));
  }
  lastSync = { at: new Date().toISOString(), machines: reports };
  return lastSync;
}

export async function pingMachines() {
  const machines = getMachines();
  const reports = [];
  for (const machine of machines) {
    const timeout = Number(process.env.ZK_TIMEOUT) || 8000;
    const commKey = Number(process.env.ZK_COMM_KEY) || 0;
    const zk = new ZKLib(machine.ip, machine.port, timeout, 4100 + Number(machine.id || 0), commKey, "tcp");
    const item = { ...machine, ok: false, info: null, error: null };
    try {
      await zk.createSocket();
      item.info = await zk.getInfo();
      item.ok = true;
    } catch (err) {
      item.error = err.message || String(err);
    } finally {
      try {
        await zk.disconnect();
      } catch {
        // ignore
      }
    }
    reports.push(item);
  }
  return reports;
}
