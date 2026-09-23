import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { App as AntApp, Avatar, Button, Progress, Select, Spin, Table, Tag } from "antd";
import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  DollarOutlined,
  EnvironmentOutlined,
  GlobalOutlined,
  LineChartOutlined,
  NotificationOutlined,
  PhoneOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import PayslipViewer from "../components/PayslipViewer";

const FLAG_LEGEND = [
  { label: "Present", color: "#2563eb" },
  { label: "Late", color: "#f59e0b" },
  { label: "Early", color: "#22c55e" },
  { label: "Half Day", color: "#f97316" },
  { label: "Absent", color: "#ef4444" },
  { label: "Leave", color: "#a3e635" },
  { label: "Missing", color: "#ec4899" },
  { label: "OFF", color: "#475569" },
];

const WEEK_LEGEND = [
  { label: "Scheduled", color: "#ef4444" },
  { label: "Worked", color: "#2563eb" },
  { label: "Average", color: "#f97316" },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function initials(name = "") {
  return name.split(" ").filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "?";
}

function hashColor(id) {
  const palette = ["#2563eb", "#db2777", "#0f766e", "#7c3aed", "#d97706", "#0891b2", "#16a34a"];
  let hash = 0;
  for (const ch of String(id || "")) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length];
}

function clockLabel(hours) {
  const total = Math.max(0, Math.round((hours || 0) * 60));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function hoursToHms(hours) {
  const totalSec = Math.max(0, Math.round((hours || 0) * 3600));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s || 0).padStart(2, "0")}`;
}

function to12h(time) {
  if (!time) return "—";
  const [h, m, s] = String(time).split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, "0")}:${String(s || 0).padStart(2, "0")} ${ampm}`;
}

function WeekTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="chart-tip">
      <b>{label}</b>
      <div>Scheduled: {d.scheduledLabel}</div>
      <div>Worked: {d.workedLabel}</div>
      <div>Average: {d.averageLabel}</div>
    </div>
  );
}

function ChartTip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="chart-tip">
      <b>{d.fullDate}</b>
      <div>Check in: {to12h(d.checkIn)}</div>
      <div>Check out: {to12h(d.checkOut)}</div>
      <div>Worked: {clockLabel(d.hours)}</div>
      <div>Status: {d.status}</div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const [data, setData] = useState(null);
  const [todayPunch, setTodayPunch] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [chartMonth, setChartMonth] = useState("current");
  const [flagChart, setFlagChart] = useState([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [teamTab, setTeamTab] = useState("team");
  const [payslipPeriods, setPayslipPeriods] = useState([]);
  const [payslipOpen, setPayslipOpen] = useState(false);
  const [payslipLoading, setPayslipLoading] = useState(false);
  const [payslip, setPayslip] = useState(null);

  const monthOptions = useMemo(() => {
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const fmt = (d) => d.toLocaleString("en-US", { month: "long", year: "numeric" });
    return [
      { value: "current", label: `Current month · ${fmt(now)}` },
      { value: "previous", label: `Previous month · ${fmt(prev)}` },
    ];
  }, []);

  async function load() {
    setLoadError("");
    const [{ data: summary }, todayRes, payslipRes] = await Promise.all([
      api.get("/dashboard/summary"),
      api.get("/attendance/today").catch(() => ({ data: null })),
      api.get("/dashboard/payslips").catch(() => ({ data: { periods: [] } })),
    ]);
    setData(summary);
    setFlagChart(summary.flagChart || []);
    setChartMonth("current");
    setTodayPunch(todayRes.data);
    setPayslipPeriods(payslipRes.data?.periods || []);
  }

  async function openPayslip(periodKey) {
    setPayslipOpen(true);
    setPayslipLoading(true);
    setPayslip(null);
    try {
      const { data } = await api.get(`/dashboard/payslips/${periodKey}`);
      setPayslip(data.payslip);
    } catch (err) {
      message.error(err.response?.data?.message || "Could not load payslip");
      setPayslipOpen(false);
    } finally {
      setPayslipLoading(false);
    }
  }

  async function loadFlagChart(mode) {
    setChartMonth(mode);
    if (mode === "current") {
      setFlagChart(data?.flagChart || []);
      return;
    }
    setChartLoading(true);
    try {
      const now = new Date();
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const { data: summary } = await api.get("/dashboard/summary", {
        params: { year: prev.getFullYear(), month: prev.getMonth() + 1 },
      });
      setFlagChart(summary.flagChart || []);
    } catch (err) {
      message.error(err.response?.data?.message || "Could not load previous month");
      setChartMonth("current");
      setFlagChart(data?.flagChart || []);
    } finally {
      setChartLoading(false);
    }
  }

  useEffect(() => {
    load().catch((err) => {
      const msg = err.response?.data?.message || "Dashboard load failed";
      setLoadError(msg);
      message.error(msg);
    });
  }, []);

  const emp = data?.employee || {};
  const firstName = (emp.name || user?.name || "there").split(" ")[0];
  const summaryMap = useMemo(() => {
    const m = {};
    for (const s of data?.summary || []) m[s.label] = s.balance;
    return m;
  }, [data]);

  if (!data) {
    return (
      <div className="ed-boot">
        {loadError ? (
          <>
            <p>{loadError}</p>
            <Button type="primary" onClick={() => load().catch((err) => setLoadError(err.response?.data?.message || "Dashboard load failed"))}>
              Retry
            </Button>
          </>
        ) : (
          <Spin size="large" />
        )}
      </div>
    );
  }

  const present = summaryMap.Present || 0;
  const late = summaryMap.Late || 0;
  const absent = summaryMap.Absent || 0;
  const leave = summaryMap.Leave || 0;
  const worked = data.totals?.totalWorkHours || 0;
  const scheduled = data.totals?.scheduledHours || 0;
  const workPct = scheduled ? Math.min(100, Math.round((worked / scheduled) * 100)) : 0;

  return (
    <div className="ed-dash">
      <section className="ed-hero ed-enter">
        <div>
          <h1>
            {greeting()}, {firstName}! <span aria-hidden>👋</span>
          </h1>
          <p>Here&apos;s your Softnox attendance snapshot for this month.</p>
        </div>
      </section>

      <section className="ed-kpis">
        {[
          { label: "Present", value: present, icon: <CheckCircleOutlined />, tone: "green" },
          { label: "Late", value: late, icon: <ClockCircleOutlined />, tone: "amber" },
          { label: "Absent", value: absent, icon: <CloseCircleOutlined />, tone: "red" },
          { label: "On leave", value: leave, icon: <CalendarOutlined />, tone: "blue" },
          { label: "Hours worked", value: clockLabel(worked), icon: <LineChartOutlined />, tone: "navy", hint: `${workPct}% of schedule` },
        ].map((k, i) => (
          <article key={k.label} className={`ed-kpi tone-${k.tone} ed-enter`} style={{ animationDelay: `${50 + i * 45}ms` }}>
            <div className="ed-kpi-icon">{k.icon}</div>
            <div>
              <span>{k.label}</span>
              <strong>{k.value}</strong>
              {k.hint ? <small>{k.hint}</small> : <small>this month</small>}
            </div>
          </article>
        ))}
      </section>

      <section className="ed-flags-row">
        <aside className="ed-idcard ed-enter" style={{ animationDelay: "280ms" }} title="Hover to flip · click photo for My Info">
          <div className="ed-idcard-inner">
            <div className="ed-idcard-face ed-idcard-front">
              <div className="ed-id-brand">
                <span className="ed-id-logo"><b>soft</b>nox</span>
                <small>Technologies Pvt Ltd</small>
              </div>
              <button
                type="button"
                className="ed-id-dp"
                aria-label="Open My Info"
                onClick={() => navigate("/info")}
              >
                <span className="ed-id-dp-ring">
                  {initials(emp.name || user?.name)}
                </span>
              </button>
              <h2>{(emp.name || user?.name || "").toUpperCase()}</h2>
              <p className="ed-id-title">{(emp.jobTitle || "Employee").toUpperCase()}</p>
              <div className="ed-id-front-meta">
                <p><strong>Employee ID:</strong> {emp.empId || "—"}</p>
                <p><strong>Email:</strong> {emp.email || user?.email || "hr@softnoxtechnologies.net"}</p>
              </div>
              <em className="ed-id-hint">Hover to flip</em>
            </div>

            <div className="ed-idcard-face ed-idcard-back">
              <div className="ed-id-brand light">
                <span className="ed-id-logo"><b>soft</b>nox</span>
                <small>Technologies Pvt Ltd</small>
              </div>
              <ul className="ed-id-back-list">
                <li>
                  <PhoneOutlined />
                  <span>{emp.mobile || "0334-1229901"}</span>
                </li>
                <li>
                  <GlobalOutlined />
                  <span>www.softnoxtechnologies.com</span>
                </li>
                <li>
                  <EnvironmentOutlined />
                  <span>Plot 8 B, 203, SMCHS Block A, Karachi, Sindh 75400</span>
                </li>
              </ul>
              <div className="ed-id-terms">
                <b>Terms &amp; Conditions</b>
                <p>When lost please return to 2nd floor suite number #203.</p>
                <p>Bring this card daily at your office premises in order to be mark present.</p>
              </div>
            </div>
          </div>
        </aside>

        <article className="ed-panel ed-flags ed-enter" style={{ animationDelay: "320ms" }}>
          <header className="ed-panel-head ed-panel-head-wrap">
            <div>
              <h3><CalendarOutlined /> Attendance {chartMonth === "previous" ? "last month" : "this month"}</h3>
              <p className="muted">Daily status flags · hover a bar for punch details</p>
            </div>
            <div className="ed-flags-tools">
              <Select
                className="ed-month-select"
                value={chartMonth}
                options={monthOptions}
                onChange={loadFlagChart}
                popupMatchSelectWidth={false}
              />
              <div className="ed-legend">
                {FLAG_LEGEND.map((l) => (
                  <span key={l.label}><i style={{ background: l.color }} />{l.label}</span>
                ))}
              </div>
            </div>
          </header>
          <div className={`ed-chart tall${chartLoading ? " is-loading" : ""}`}>
            {chartLoading && (
              <div className="ed-chart-spin"><Spin size="small" /></div>
            )}
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={flagChart} margin={{ top: 8, right: 8, left: 0, bottom: 8 }} barCategoryGap="12%">
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} interval={0} angle={-35} textAnchor="end" height={52} axisLine={false} tickLine={false} />
                <YAxis
                  domain={[0, 9.72]}
                  ticks={[0, 1.38, 2.77, 4.17, 5.55, 6.93, 8.33, 9.72]}
                  tickFormatter={clockLabel}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(37,99,235,0.06)" }} />
                <Bar dataKey="barHours" maxBarSize={28} radius={[6, 6, 0, 0]}>
                  {flagChart.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      <section className="ed-row-3">
        <article className="ed-panel ed-team ed-enter" style={{ animationDelay: "360ms" }}>
          <div className="ed-team-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={teamTab === "team"}
              className={teamTab === "team" ? "active" : ""}
              onClick={() => setTeamTab("team")}
            >
              <TeamOutlined /> My team
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={teamTab === "managers"}
              className={teamTab === "managers" ? "active" : ""}
              onClick={() => setTeamTab("managers")}
            >
              <UserOutlined /> My managers
            </button>
          </div>
          <ul className="ed-team-list">
            {teamTab === "team" && (data.team?.members || []).length === 0 && (
              <li className="muted" style={{ display: "block", padding: 12 }}>No other members in your team.</li>
            )}
            {teamTab === "managers" && (data.team?.managers || []).length === 0 && (
              <li className="muted" style={{ display: "block", padding: 12 }}>No managers found.</li>
            )}
            {(teamTab === "team" ? data.team?.members || [] : data.team?.managers || []).map((m) => (
              <li key={m.empId}>
                <Avatar size={36} style={{ background: hashColor(m.empId), flexShrink: 0 }}>
                  {initials(m.name)}
                </Avatar>
                <div className="ed-team-copy">
                  <b>{m.name}</b>
                  <small>{m.jobTitle} · Emp {m.empId}</small>
                </div>
                <Tag className={`ed-team-role ${(m.role || "member").toLowerCase()}`}>{m.role || "Member"}</Tag>
              </li>
            ))}
          </ul>
          <p className="ed-team-hint">View only</p>
        </article>

        <article className="ed-panel ed-punch ed-enter" style={{ animationDelay: "400ms" }}>
          <header className="ed-panel-head">
            <h3>Today&apos;s punch</h3>
            <span className="muted">{data.today?.displayDate || "Today"}</span>
          </header>
          <div className="ed-punch-status">
            {todayPunch?.checkIn ? (
              <p>
                Signed in at <b>{to12h(todayPunch.checkIn)}</b>
                {todayPunch?.checkOut ? <> · Out at <b>{to12h(todayPunch.checkOut)}</b></> : null}
              </p>
            ) : (
              <p>You haven&apos;t signed in yet today.</p>
            )}
            <small>
              Shift: {data.today?.shiftName || emp.shift || "Rotational"}
              {todayPunch?.hours ? ` · Worked ${clockLabel(todayPunch.hours)}` : ""}
            </small>
          </div>
          <div className="ed-work-meter" style={{ marginTop: 16 }}>
            <div className="ed-work-meter-top">
              <span>Month progress</span>
              <b>{clockLabel(worked)} / {clockLabel(scheduled)}</b>
            </div>
            <Progress percent={workPct} showInfo={false} strokeColor="#2563eb" trailColor="#e2e8f0" />
          </div>
        </article>

        <article className="ed-panel ed-news ed-enter" style={{ animationDelay: "440ms" }}>
          <header className="ed-panel-head">
            <h3><NotificationOutlined /> Announcements</h3>
            <span className="muted">{(data.announcements || []).length} posts</span>
          </header>
          <ul className="ed-news-list">
            {(data.announcements || []).length === 0 && (
              <li className="muted" style={{ display: "block", padding: 12 }}>No announcements yet.</li>
            )}
            {(data.announcements || []).slice(0, 5).map((a) => (
              <li key={a.id}>
                <span className={`ed-news-dot tone-${a.audience === "employees" ? "green" : "blue"}`} />
                <div>
                  <b>{a.title}</b>
                  <p>{a.body}</p>
                  <small>
                    {a.createdAt ? new Date(a.createdAt).toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
                    {a.createdBy ? ` · ${a.createdBy}` : ""}
                  </small>
                </div>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="ed-row-leave-week">
        <article className="ed-panel ed-leaves ed-enter" style={{ animationDelay: "480ms" }}>
          <header className="ed-panel-head">
            <h3>Leave balances</h3>
            <Link to="/leave" className="ed-link">Apply →</Link>
          </header>
          <ul className="ed-leave-list">
            {(data.balances || []).map((b) => (
              <li key={b.type}>
                <div>
                  <b>{b.label}</b>
                  <Progress
                    percent={Math.min(100, (Number(b.balance) / (b.type === "annual" ? 8 : 6)) * 100)}
                    showInfo={false}
                    size="small"
                    strokeColor={b.type === "sick" ? "#f59e0b" : b.type === "annual" ? "#7c3aed" : "#2563eb"}
                    trailColor="#eef2f7"
                  />
                </div>
                <em>{Number(b.balance).toFixed(1)}</em>
              </li>
            ))}
          </ul>
        </article>

        <article className="ed-panel ed-payslip ed-enter" style={{ animationDelay: "500ms" }}>
          <header className="ed-payslip-head">
            <DollarOutlined />
            <h3>Employee payslip</h3>
          </header>
          <p className="ed-payslip-sub">Payslip period</p>
          <ul className="ed-payslip-list">
            {payslipPeriods.map((p) => (
              <li key={p.periodKey}>
                <span>{p.label}</span>
                {p.expected ? (
                  <em>Expected Payslip</em>
                ) : (
                  <button type="button" className="ed-payslip-link" onClick={() => openPayslip(p.periodKey)}>
                    View Payslip
                  </button>
                )}
              </li>
            ))}
            {!payslipPeriods.length && (
              <li className="muted" style={{ display: "block", padding: 12 }}>No payslip periods yet.</li>
            )}
          </ul>
        </article>

        <article className="ed-panel ed-enter" style={{ animationDelay: "520ms" }}>
          <header className="ed-panel-head ed-panel-head-wrap">
            <div>
              <h3><LineChartOutlined /> Weekly hours</h3>
              <p className="muted">Scheduled vs worked vs average</p>
            </div>
            <div className="ed-legend">
              {WEEK_LEGEND.map((l) => (
                <span key={l.label}><i style={{ background: l.color }} />{l.label}</span>
              ))}
            </div>
          </header>
          <div className="ed-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.weekChart || []} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis
                  domain={[0, 50]}
                  ticks={[0, 10, 20, 30, 40, 50]}
                  tickFormatter={hoursToHms}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  width={70}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<WeekTip />} />
                <Line type="monotone" dataKey="scheduled" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 3, fill: "#ef4444", strokeWidth: 0 }} />
                <Line type="monotone" dataKey="worked" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3, fill: "#2563eb", strokeWidth: 0 }} />
                <Line type="monotone" dataKey="average" stroke="#f97316" strokeWidth={2.5} dot={{ r: 3, fill: "#f97316", strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <Table
            className="ed-week-table"
            size="small"
            pagination={false}
            rowKey="week"
            dataSource={data.weekChart || []}
            columns={[
              { title: "Week", dataIndex: "week" },
              { title: "Range", dataIndex: "description", ellipsis: true },
              { title: "Scheduled", dataIndex: "scheduledLabel" },
              { title: "Worked", dataIndex: "workedLabel" },
              { title: "Average", dataIndex: "averageLabel" },
            ]}
          />
        </article>
      </section>

      <PayslipViewer
        open={payslipOpen}
        loading={payslipLoading}
        payslip={payslip}
        onClose={() => setPayslipOpen(false)}
      />
    </div>
  );
}
