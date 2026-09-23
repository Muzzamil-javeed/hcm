import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import { connectDb } from "../config/db.js";
import { Employee } from "../models/Employee.js";
import { LeaveBalance } from "../models/LeaveBalance.js";
import {
  LEAVE_QUOTA,
  lookupRemaining,
  splitRemaining,
} from "../data/leaveQuotaJanAug.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function updateLeaveBalancesFromSheet({ disconnect = false } = {}) {
  if (mongoose.connection.readyState !== 1) {
    await connectDb(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/flowhcm");
  }

  const employees = await Employee.find().select("empId name jobTitle").lean();
  let matched = 0;
  let unmatched = 0;
  let special = 0;

  for (const emp of employees) {
    const remaining = lookupRemaining(emp.name, emp.jobTitle);
    let balances;
    if (remaining === null) {
      unmatched += 1;
      balances = { ...LEAVE_QUOTA };
    } else {
      matched += 1;
      balances = splitRemaining(remaining);
      if (balances.note && balances.note !== "allotted") special += 1;
    }

    await LeaveBalance.findOneAndUpdate(
      { empId: emp.empId },
      {
        $set: {
          empId: emp.empId,
          casual: balances.casual,
          annual: balances.annual,
          sick: balances.sick,
        },
      },
      { upsert: true }
    );
  }

  const sample = await LeaveBalance.findOne({ empId: "112" }).lean();
  console.log(
    `Leave balances updated: matched=${matched}, unmatched(default quota)=${unmatched}, special=${special}, total=${employees.length}`
  );
  if (sample) {
    console.log(
      `Sample emp 112: casual=${sample.casual} annual=${sample.annual} sick=${sample.sick}`
    );
  }

  if (disconnect) await mongoose.disconnect();
  return { matched, unmatched, special, total: employees.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  updateLeaveBalancesFromSheet({ disconnect: true })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
