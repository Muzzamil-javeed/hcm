export const OFFICE_START = "09:00:00";
export const GRACE_MINUTES = 15;
export const FULL_DAY_HOURS = 9;
/** Office work-day: 08:00 → next day 07:59:59 */
export const WORKDAY_CUTOFF = "08:00:00";

export const EMPLOYEE_OFF_DATES = {
  112: ["2026-08-14"],
};

export function isPersonalOff(empId, date) {
  return (EMPLOYEE_OFF_DATES[String(empId)] || []).includes(date);
}

export function parseTimeToMinutes(time) {
  const [h, m, s] = time.split(":").map(Number);
  return h * 60 + m + (s || 0) / 60;
}

export function minutesToHourLabel(mins) {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}

export function isWeekend(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  const day = d.getDay();
  return day === 0 || day === 6;
}

export function formatDisplayDate(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${String(d.getDate()).padStart(2, "0")}-${months[d.getMonth()]}-${d.getFullYear()}`;
}

export function formatShortDate(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${String(d.getDate()).padStart(2, "0")}-${months[d.getMonth()]}`;
}

export function todayStr(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  return todayStr(d);
}

export function workDateFor(punch) {
  const date = punch.date;
  const time = punch.time || "00:00:00";
  if (time < WORKDAY_CUTOFF) return addDays(date, -1);
  return date;
}

/** Current office day: 08:00–next day 07:59:59 */
export function currentWorkDate(now = new Date()) {
  const date = todayStr(now);
  const time = now.toTimeString().slice(0, 8);
  if (time < WORKDAY_CUTOFF) return addDays(date, -1);
  return date;
}

export function isOpenWorkday(date, now = new Date()) {
  return date === currentWorkDate(now);
}

export function hoursBetween(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const start = parseTimeToMinutes(checkIn);
  let end = parseTimeToMinutes(checkOut);
  if (end < start) end += 24 * 60;
  return Math.max(0, (end - start) / 60);
}

export function monthRange(year, monthIndex) {
  const days = [];
  const last = new Date(year, monthIndex + 1, 0).getDate();
  for (let d = 1; d <= last; d++) {
    days.push(`${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  return days;
}

function punchKey(p) {
  return `${p.date || ""}T${p.time || "00:00:00"}`;
}

export function classifyDay({ punches, leave, date, now = new Date(), empId = "" }) {
  if (isWeekend(date) || isPersonalOff(empId, date)) {
    return { status: "OFF", hours: 0, checkIn: null, checkOut: null, shiftName: "OFF" };
  }

  if (leave) {
    return { status: "Leave", hours: 0, checkIn: null, checkOut: null, shiftName: "Leave" };
  }

  const sorted = punchesForWorkDate(punches, date);

  if (!sorted.length) {
    return { status: "Absent", hours: 0, checkIn: null, checkOut: null, shiftName: "—" };
  }

  const checkIn = sorted[0].time;
  const checkOut = sorted.length > 1 ? sorted.at(-1).time : null;
  const open = isOpenWorkday(date, now);
  let hours = hoursBetween(checkIn, checkOut);

  if (open && checkIn && !checkOut) {
    hours = hoursBetween(checkIn, now.toTimeString().slice(0, 8));
  }

  hours = Math.min(hours, 16);
  const shiftName = `${checkIn.slice(0, 5)} – ${checkOut ? checkOut.slice(0, 5) : "open"}`;

  if (hours + 1e-9 >= FULL_DAY_HOURS) {
    return { status: "Present", hours, checkIn, checkOut, shiftName };
  }
  return { status: "Half Day", hours, checkIn, checkOut, shiftName };
}

export function punchesForWorkDate(logs, workDate) {
  return dedupePunches(logs.filter((p) => workDateFor(p) === workDate)).sort((a, b) =>
    punchKey(a).localeCompare(punchKey(b))
  );
}

export function buildDailyRecords(logs, leavesByDate, dates, now = new Date(), _employeeShift = "", empId = "") {
  return dates.map((date) => {
    const punches = punchesForWorkDate(logs, date);
    const leave = leavesByDate.get(date);
    const classified = classifyDay({ punches, leave, date, now, empId });
    return {
      date,
      label: formatShortDate(date),
      displayDate: formatDisplayDate(date),
      ...classified,
      punchCount: punches.length,
    };
  });
}

export function dedupePunches(punches, windowMin = 2) {
  const sorted = [...punches].sort((a, b) => {
    const byKey = punchKey(a).localeCompare(punchKey(b));
    if (byKey) return byKey;
    return new Date(a.punchedAt || 0) - new Date(b.punchedAt || 0);
  });
  const result = [];
  for (const punch of sorted) {
    const prev = result.at(-1);
    if (prev) {
      const gap = Math.abs(
        new Date(`${punch.date}T${punch.time || "00:00:00"}`).getTime() -
          new Date(`${prev.date}T${prev.time || "00:00:00"}`).getTime()
      );
      if (Number.isFinite(gap) && gap <= windowMin * 60 * 1000) continue;
    }
    result.push(punch);
  }
  return result;
}

export const FLAG_COLORS = {
  Present: "#0076fa",
  Late: "#F5C542",
  Early: "#7CB342",
  "Half Day": "#fe9839",
  Absent: "#ff001d",
  "Short Day": "#FF8A65",
  "Absent For Short Time": "#455A64",
  Leave: "#F0E68C",
  "Schedule Days": "#90A4AE",
  Missing: "#EC407A",
  OFF: "#1f2527",
};

export function hoursToClock(hours) {
  const total = Math.max(0, Math.round((hours || 0) * 60));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

export function hoursToHms(hours) {
  const totalSec = Math.max(0, Math.round((hours || 0) * 3600));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const WEEK_NAMES = ["First Week", "Second Week", "Third Week", "Fourth Week", "Fifth Week", "Sixth Week"];

export function weekIndexInMonth(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const firstDow = (first.getDay() + 6) % 7;
  return Math.floor((d.getDate() - 1 + firstDow) / 7);
}

export function buildWeekChart(daily) {
  const buckets = WEEK_NAMES.map((week) => ({
    week,
    description: "Working Hours",
    scheduledHours: 0,
    workedHours: 0,
    weekdayCount: 0,
  }));
  let maxIdx = 0;
  for (const day of daily) {
    const idx = weekIndexInMonth(day.date);
    if (idx < 0 || idx >= buckets.length) continue;
    maxIdx = Math.max(maxIdx, idx);
    const bucket = buckets[idx];
    if (!isWeekend(day.date)) {
      bucket.weekdayCount += 1;
      bucket.scheduledHours += FULL_DAY_HOURS;
    }
    bucket.workedHours += day.hours || 0;
  }
  return buckets.slice(0, maxIdx + 1).map((bucket) => {
    const averageHours = bucket.weekdayCount ? bucket.workedHours / bucket.weekdayCount : 0;
    return {
      week: bucket.week,
      description: bucket.description,
      scheduled: Number(bucket.scheduledHours.toFixed(4)),
      worked: Number(bucket.workedHours.toFixed(4)),
      average: Number(averageHours.toFixed(4)),
      scheduledLabel: hoursToHms(bucket.scheduledHours),
      workedLabel: hoursToHms(bucket.workedHours),
      averageLabel: hoursToHms(averageHours),
    };
  });
}
