import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { App as AntApp, Button, Card, Col, Row, Space, Table, Typography } from "antd";
import { CalendarOutlined } from "@ant-design/icons";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import api from "../api";
import { useAuth } from "../context/AuthContext";

const FLAG_LEGEND = [
  { label: "Present", color: "#0076fa" },
  { label: "Late", color: "#F5C542" },
  { label: "Early", color: "#7CB342" },
  { label: "HalfDay", color: "#fe9839" },
  { label: "Absent", color: "#ff001d" },
  { label: "Short Day", color: "#FF8A65" },
  { label: "Absent For Short Time", color: "#455A64" },
  { label: "Leave", color: "#F0E68C" },
  { label: "Sch Days", color: "#90A4AE" },
  { label: "Missing", color: "#EC407A" },
  { label: "OFF", color: "#1f2527" },
];

function clockLabel(hours) {
  const total = Math.max(0, Math.round((hours || 0) * 60));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function to12h(time) {
  if (!time) return "—";
  const [h, m, s] = String(time).split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, "0")}:${String(s || 0).padStart(2, "0")} ${ampm}`;
}

function ChartTip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="chart-tip">
      <b>{d.fullDate}</b>
      <div>TimeIn: {to12h(d.checkIn)}</div>
      <div>TimeOut: {to12h(d.checkOut)}</div>
      <div>TotalWorkedHrs: {clockLabel(d.hours)}</div>
      <div>Status: {d.status}</div>
      <div>Shift: {d.shiftName || "—"}</div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { message } = AntApp.useApp();
  const [data, setData] = useState(null);
  const [todayPunch, setTodayPunch] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const [{ data: summary }, { data: today }] = await Promise.all([
      api.get("/dashboard/summary"),
      api.get("/attendance/today"),
    ]);
    setData(summary);
    setTodayPunch(today);
  }

  useEffect(() => {
    load().catch((err) => message.error(err.response?.data?.message || "Dashboard load failed"));
  }, []);

  async function punch(kind) {
    setBusy(true);
    try {
      const { data: res } = await api.post(`/attendance/${kind}`);
      message.success(res.message);
      await load();
    } catch (err) {
      message.error(err.response?.data?.message || "Punch failed");
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <Typography.Text>Loading dashboard...</Typography.Text>;
  const emp = data.employee || {};
  const initials = (emp.name || user?.name || "U")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={6}>
          <Card className="soft-card profile-panel">
            <div className="profile-pic">{initials}</div>
            <Typography.Title level={4} style={{ marginBottom: 0 }}>
              {emp.name} ({emp.empId})
            </Typography.Title>
            <div className="job">{emp.jobTitle}</div>
            <div className="info-list">
              <div><span>Employee ID</span><b>{emp.empId}</b></div>
              <div><span>Department</span><b>{emp.department || "-"}</b></div>
              <div><span>Shift</span><b>{emp.shift || "Rotational"}</b></div>
            </div>
          </Card>
        </Col>

        <Col xs={24} xl={18}>
          <Card className="soft-card flag-card">
            <div className="flag-head">
              <div className="flag-title"><CalendarOutlined /> ATTENDANCE FLAG SUMMARY</div>
              <div className="flag-actions">
                <Link className="flag-link" to="/attendance">View Attendance Detail</Link>
                <span className="flag-pill">{emp.name} ({emp.empId})</span>
                <span className="flag-pill">Total Worked Hours</span>
                <span className="flag-pill">Current Month</span>
              </div>
            </div>
            <div className="legend flag-legend">
              {FLAG_LEGEND.map((l) => (
                <span key={l.label}><i style={{ background: l.color }} />{l.label}</span>
              ))}
            </div>
            <div style={{ height: 320 }}>
              <ResponsiveContainer>
                <BarChart data={data.flagChart} margin={{ top: 8, right: 8, left: 8, bottom: 8 }} barCategoryGap="12%">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e6e2d6" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={0} angle={-35} textAnchor="end" height={52} />
                  <YAxis
                    domain={[0, 9.72]}
                    ticks={[0, 1.38, 2.77, 4.17, 5.55, 6.93, 8.33, 9.72]}
                    tickFormatter={clockLabel}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="barHours" maxBarSize={36} radius={[3, 3, 0, 0]}>
                    {data.flagChart.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card className="soft-card">
            <div className="sign-msg">
              {todayPunch?.checkIn
                ? `You signed in today at ${to12h(todayPunch.checkIn)}.`
                : "You have not signed in today."}
            </div>
            {todayPunch?.checkOut && (
              <div className="muted">Checked out at {to12h(todayPunch.checkOut)}</div>
            )}
            <div className="muted" style={{ marginTop: 8 }}>
              Shift: {data.today?.shiftName || emp.shift || "Rotational"}
              {todayPunch?.hours ? ` · Worked ${clockLabel(todayPunch.hours)}` : ""}
            </div>
            <Space style={{ marginTop: 12 }}>
              <Button type="primary" loading={busy} disabled={!todayPunch?.canCheckIn} onClick={() => punch("check-in")}>
                Check In
              </Button>
              <Button loading={busy} disabled={!todayPunch?.canCheckOut} onClick={() => punch("check-out")}>
                Check Out
              </Button>
            </Space>
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card className="soft-card" title="Leave Summary">
            <Table
              size="small"
              pagination={false}
              rowKey="type"
              dataSource={data.balances || []}
              columns={[
                { title: "Leave Type", dataIndex: "label" },
                { title: "Balance", dataIndex: "balance", render: (v) => Number(v).toFixed(2) },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
