import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import api from "../api";
import { useAuth } from "../context/AuthContext";

function to12h(time) {
  if (!time) return "-";
  const [h, m, s] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, "0")}:${String(s || 0).padStart(2, "0")} ${ampm}`;
}

export default function Attendance() {
  const { user } = useAuth();
  const [empId, setEmpId] = useState(user?.empId || "112");
  const [employees, setEmployees] = useState([]);
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [today, setToday] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load(id = empId) {
    const [{ data: empRes }, { data: logRes }, { data: dash }, { data: todayRes }] = await Promise.all([
      api.get("/dashboard/employees"),
      api.get("/attendance/logs", { params: { empId: id } }),
      api.get("/dashboard/summary", { params: { empId: id } }),
      api.get("/attendance/today", { params: { empId: id } }),
    ]);
    setEmployees(empRes.employees);
    setLogs(logRes.logs);
    setSummary(dash);
    setToday(todayRes);
  }

  useEffect(() => {
    load(empId).catch(console.error);
  }, [empId]);

  async function punch(kind) {
    setBusy(true);
    try {
      await api.post(`/attendance/${kind}`);
      await load(empId);
    } catch (err) {
      alert(err.response?.data?.message || "Punch failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="page-title">ATTENDANCE</div>
      <div className="grid" style={{ gridTemplateColumns: "320px 1fr" }}>
        <div className="card">
          <div className="card-h">CHECK IN / CHECK OUT</div>
          <div className="attend-status">
            <select value={empId} onChange={(e) => setEmpId(e.target.value)} style={{ marginBottom: 12 }}>
              {employees.map((e) => (
                <option key={e.empId} value={e.empId}>{e.name} ({e.empId})</option>
              ))}
            </select>
            <h3>{today?.checkIn ? `In: ${to12h(today.checkIn)}` : "Not checked in"}</h3>
            <p style={{ color: "#888", margin: "6px 0 14px" }}>{today?.checkOut ? `Out: ${to12h(today.checkOut)}` : "Still working / no checkout"}</p>
            {empId === user?.empId && (
              <div className="punch-row">
                <button className="btn-in" disabled={busy || !today?.canCheckIn} onClick={() => punch("check-in")}>Check In</button>
                <button className="btn-out" disabled={busy || !today?.canCheckOut} onClick={() => punch("check-out")}>Check Out</button>
              </div>
            )}
          </div>
        </div>
        <div className="card">
          <div className="card-h">MONTHLY WORKED HOURS</div>
          <div style={{ height: 220, padding: 8 }}>
            {summary && (
              <ResponsiveContainer>
                <BarChart data={summary.flagChart}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={0} angle={-35} textAnchor="end" height={48} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="hours" maxBarSize={14}>
                    {summary.flagChart.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="card-h">PUNCH LOGS</div>
        <div className="card-b">
          <table>
            <thead>
              <tr>
                <th>Emp ID</th>
                <th>Date</th>
                <th>Time</th>
                <th>Type</th>
                <th>IP</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {logs.slice(0, 80).map((log) => (
                <tr key={log._id}>
                  <td>{log.empId}</td>
                  <td>{log.date}</td>
                  <td>{to12h(log.time)}</td>
                  <td>{log.type === 1 ? "Check In" : "Check Out"}</td>
                  <td>{log.ip || "-"}</td>
                  <td>{log.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
