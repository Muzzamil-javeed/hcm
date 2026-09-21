import { Asset } from "../models/Asset.js";

const CATALOG = [
  { type: "laptop", name: "Dell Latitude Laptop", category: "AST", categoryCode: "AST-001" },
  { type: "mouse", name: "Logitech Wireless Mouse", category: "AST", categoryCode: "AST-002" },
  { type: "keyboard", name: "Mechanical Keyboard", category: "AST", categoryCode: "AST-003" },
  { type: "headset", name: "Noise Cancelling Headset", category: "AST", categoryCode: "AST-004" },
  { type: "monitor", name: "24\" LED Monitor", category: "AST", categoryCode: "AST-005" },
  { type: "phone", name: "Company Mobile Handset", category: "AST", categoryCode: "AST-006" },
  { type: "idcard", name: "Softnox Access Card", category: "ID", categoryCode: "ID-001" },
  { type: "access", name: "Door Access Tag", category: "ACC", categoryCode: "ACC-001" },
];

function hash(str) {
  let h = 0;
  for (const ch of String(str || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

/** Ensure each employee has a deterministic Softnox asset kit (create once). */
export async function ensureEmployeeAssets(employee) {
  const empId = String(employee?.empId || "").trim();
  if (!empId) return [];

  const existing = await Asset.find({ empId, status: "assigned" }).sort({ assignedAt: -1 }).lean();
  if (existing.length) return existing;

  const h = hash(empId);
  const count = 3 + (h % 3); // 3–5 assets
  const picks = [];
  for (let i = 0; i < count; i += 1) {
    picks.push(CATALOG[(h + i * 3) % CATALOG.length]);
  }
  // Always include laptop + id card for Softnox staff
  if (!picks.some((p) => p.type === "laptop")) picks[0] = CATALOG[0];
  if (!picks.some((p) => p.type === "idcard")) picks.push(CATALOG[6]);

  const assignedBy = employee?.reportsTo && employee.reportsTo !== "-"
    ? employee.reportsTo
    : "Softnox IT";

  const join = employee?.joiningDate && /^\d{4}-\d{2}-\d{2}/.test(employee.joiningDate)
    ? new Date(`${employee.joiningDate.slice(0, 10)}T10:30:00`)
    : new Date();

  const docs = picks.map((p, idx) => {
    const serial = String(100000000 + ((h + idx * 997) % 900000000));
    const when = new Date(join.getTime() + idx * 86400000 * 2);
    return {
      empId,
      assetId: `${p.categoryCode.replace("-", "")}-${serial.slice(0, 9)}`,
      name: `${p.name} - #${serial.slice(0, 9)}`,
      category: p.category,
      categoryCode: p.categoryCode,
      type: p.type,
      assignedAt: when,
      assignedBy,
      status: "assigned",
    };
  });

  await Asset.insertMany(docs, { ordered: false }).catch(() => {});
  return Asset.find({ empId, status: "assigned" }).sort({ assignedAt: -1 }).lean();
}

/** Simple Softnox project stubs for profile tab (not persisted). */
export function buildEmployeeProjects(employee) {
  const empId = String(employee?.empId || "");
  const h = hash(empId);
  const dept = employee?.department || "Softnox";
  const templates = [
    { title: `${dept} Delivery`, icon: "world", tasks: 8, completed: 15 },
    { title: "Softnox ESS Portal", icon: "code", tasks: 5, completed: 12 },
    { title: "Client Onboarding", icon: "users", tasks: 3, completed: 7 },
    { title: "QA Regression Pack", icon: "check", tasks: 6, completed: 9 },
  ];
  const n = 1 + (h % 3);
  const lead = employee?.reportsTo && employee.reportsTo !== "-" ? employee.reportsTo : "Softnox Lead";
  return templates.slice(0, n).map((t, i) => {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 14 + i * 10);
    return {
      id: `${empId}-p${i + 1}`,
      ...t,
      deadline: deadline.toISOString().slice(0, 10),
      lead,
    };
  });
}
