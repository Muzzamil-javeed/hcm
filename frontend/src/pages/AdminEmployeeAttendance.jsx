import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  App as AntApp,
  Avatar,
  DatePicker,
  Input,
  Select,
  Spin,
  Table,
  Tag,
} from "antd";
import {
  ArrowDownOutlined,
  ArrowLeftOutlined,
  ArrowUpOutlined,
  ClockCircleOutlined,
  DownloadOutlined,
  FileTextOutlined,
  UserOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import api from "../api";

const { RangePicker } = DatePicker;

function initials(name = "") {
  return name.split(" ").filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "?";
}

function hashColor(id) {
  const palette = ["#2563eb", "#db2777", "#0f766e", "#7c3aed", "#d97706", "#0891b2", "#16a34a"];
  let hash = 0;
  for (const ch of String(id || "")) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length];
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

function statusColor(status) {
  if (status === "Present") return "success";
  if (status === "Half Day") return "warning";
  if (status === "Absent") return "error";
  if (status === "OFF") return "default";
  return "processing";
}

function prodClass(hours) {
  if (hours == null) return "prod-empty";
  if (hours >= 8) return "prod-good";
  if (hours >= 4) return "prod-mid";
  return "prod-low";
}

export default function AdminEmployeeAttendance() {
  const { empId } = useParams();
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(dayjs().format("YYYY-MM"));
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date-desc");
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [range, setRange] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: res } = await api.get(`/admin/employees/${empId}/attendance`, {
          params: { month },
        });
        setData(res);
      } catch (err) {
        message.error(err.response?.data?.message || "Failed to load attendance");
        setData(null);
      } finally {
        setLoading(false);
      }
    })().catch(() => {});
  }, [empId, month, message]);

  const emp = data?.employee;
  const kpis = data?.kpis || {};
  const timeline = data?.timeline || [];
  const today = data?.today || {};

  const tableRows = useMemo(() => {
    let rows = [...(data?.rows || [])];
    if (statusFilter !== "all") {
      rows = rows.filter((r) => r.status === statusFilter);
    }
    if (range?.[0] && range?.[1]) {
      const from = range[0].format("YYYY-MM-DD");
      const to = range[1].format("YYYY-MM-DD");
      rows = rows.filter((r) => r.date >= from && r.date <= to);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (r) =>
          r.date.includes(q) ||
          String(r.status || "").toLowerCase().includes(q) ||
          String(r.checkInLabel || "").toLowerCase().includes(q) ||
          String(r.checkOutLabel || "").toLowerCase().includes(q),
      );
    }
    if (sortBy === "date-asc") rows.sort((a, b) => a.date.localeCompare(b.date));
    else if (sortBy === "hours-desc") rows.sort((a, b) => (b.hours || 0) - (a.hours || 0));
    else if (sortBy === "hours-asc") rows.sort((a, b) => (a.hours || 0) - (b.hours || 0));
    else rows.sort((a, b) => b.date.localeCompare(a.date));
    return rows;
  }, [data, statusFilter, sortBy, search, range]);

  const columns = [
    {
      title: "Date",
      dataIndex: "dateLabel",
      key: "date",
      render: (v, r) => <span>{v || r.date}</span>,
    },
    {
      title: "Check In",
      dataIndex: "checkInLabel",
      key: "in",
      render: (v) => v || "—",
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (v) => <Tag color={statusColor(v)}>{v}</Tag>,
    },
    {
      title: "Check Out",
      dataIndex: "checkOutLabel",
      key: "out",
      render: (v) => v || "—",
    },
    {
      title: "Break",
      dataIndex: "breakLabel",
      key: "break",
      render: (v) => v || "0 mins",
    },
    {
      title: "Late",
      dataIndex: "lateLabel",
      key: "late",
      render: (v) => v || "—",
    },
    {
      title: "Overtime",
      dataIndex: "otLabel",
      key: "ot",
      render: (v) => v || "—",
    },
    {
      title: "Production Hours",
      dataIndex: "hours",
      key: "hours",
      render: (v) => (
        <span className={`prod-pill ${prodClass(v)}`}>
          {v != null ? `${Number(v).toFixed(2)} hrs` : "—"}
        </span>
      ),
    },
  ];

  if (loading && !data) {
    return <div className="boot" style={{ minHeight: 320 }}><Spin size="large" /></div>;
  }

  if (!emp) {
    return (
      <div className="emp-att-page">
        <button type="button" className="ad-link" onClick={() => navigate("/admin/attendance")}>
          ← Back to Attendance
        </button>
        <p className="muted">Employee not found.</p>
      </div>
    );
  }

  const firstName = emp.name?.split(" ")[0] || emp.name;
  const maxSeg = Math.max(...timeline.map((t) => t.minutes || 0), 1);

  return (
    <div className="emp-att-page">
      <div className="emp-att-head">
        <div>
          <div className="emp-profile-crumb">
            <button type="button" className="crumb-back" onClick={() => navigate("/admin/attendance")}>
              <ArrowLeftOutlined /> Attendance
            </button>
            <span>/</span>
            <Link to={`/admin/employees/${emp.empId}`}>{emp.name}</Link>
            <span>/</span>
            <b>Employee Attendance</b>
          </div>
          <h1>Employee Attendance</h1>
        </div>
        <div className="emp-att-actions">
          <Link className="emp-icon-btn" to={`/admin/employees/${emp.empId}`} title="Profile">
            <UserOutlined />
          </Link>
          <button type="button" className="emp-btn ghost" onClick={() => message.info("Export coming soon")}>
            <DownloadOutlined /> Export
          </button>
          <button type="button" className="emp-btn accent" onClick={() => message.info("Report coming soon")}>
            <FileTextOutlined /> Report
          </button>
        </div>
      </div>

      <div className="emp-att-top">
        <article className="emp-att-punch ad-enter">
          <div className="emp-att-punch-head">
            <Avatar size={64} style={{ background: hashColor(emp.empId), fontSize: 22, border: "3px solid #00d27a" }}>
              {initials(emp.name)}
            </Avatar>
            <div>
              <h3>{greeting()}, {firstName}</h3>
              <p className="muted">{dayjs().format("dddd, DD MMM YYYY · hh:mm A")}</p>
            </div>
          </div>
          <div className="emp-viz-tags">
            <span className="prod-pill prod-mid">
              Production: {today.hours != null ? Number(today.hours).toFixed(2) : "0.00"} hrs
            </span>
            <span className="muted" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <ClockCircleOutlined /> Punch In at {today.checkInLabel || "—"}
            </span>
          </div>
          <Link className="emp-btn primary block" to={`/admin/employees/${emp.empId}`}>
            View Full Profile
          </Link>
        </article>

        <div className="emp-att-kpis">
          {[
            {
              label: "Total Hours Today",
              value: `${Number(kpis.todayHours || 0).toFixed(2)} / 9`,
              tone: "orange",
              delta: kpis.todayDelta,
            },
            {
              label: "Total Hours Week",
              value: `${Number(kpis.weekHours || 0).toFixed(2)} / 40`,
              tone: "dark",
              delta: kpis.weekDelta,
            },
            {
              label: "Total Hours Month",
              value: `${Number(kpis.monthHours || 0).toFixed(1)} / ${kpis.monthTarget || 160}`,
              tone: "blue",
              delta: kpis.monthDelta,
            },
            {
              label: "Overtime this Month",
              value: `${Number(kpis.otHours || 0).toFixed(2)} / 28`,
              tone: "pink",
              delta: kpis.otDelta,
            },
          ].map((k, i) => (
            <article key={k.label} className={`emp-att-kpi tone-${k.tone} ad-enter`} style={{ animationDelay: `${(i + 1) * 50}ms` }}>
              <span className="kpi-dot" />
              <p>{k.label}</p>
              <strong>{k.value}</strong>
              {k.delta != null && (
                <small className={k.delta >= 0 ? "up" : "down"}>
                  {k.delta >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                  {Math.abs(Number(k.delta)).toFixed(1)}%
                </small>
              )}
            </article>
          ))}
        </div>
      </div>

      <section className="emp-att-timeline ad-enter" style={{ animationDelay: "120ms" }}>
        <div className="emp-att-timeline-stats">
          <div>
            <span>Total Working hours</span>
            <strong>{Number(kpis.monthHours || 0).toFixed(2)} hrs</strong>
          </div>
          <div>
            <span>Productive Hours</span>
            <strong>{Number(kpis.productiveHours || kpis.monthHours || 0).toFixed(2)} hrs</strong>
          </div>
          <div>
            <span>Break hours</span>
            <strong>{Number(kpis.breakHours || 0).toFixed(2)} hrs</strong>
          </div>
          <div>
            <span>Overtime</span>
            <strong>{Number(kpis.otHours || 0).toFixed(2)} hrs</strong>
          </div>
        </div>
        <div className="emp-att-bar">
          {timeline.length ? (
            timeline.map((seg, idx) => (
              <div
                key={`${seg.label}-${idx}`}
                className={`seg ${seg.type || "work"}`}
                style={{ flex: Math.max(seg.minutes || 1, 1) / maxSeg }}
                title={`${seg.label}: ${seg.minutes || 0} min`}
              />
            ))
          ) : (
            <div className="seg empty" style={{ flex: 1 }} />
          )}
        </div>
        <div className="emp-att-axis">
          {["06:00", "07:00", "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"].map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      </section>

      {(data?.weekChart || []).length > 0 && (
        <section className="emp-att-chart ad-enter" style={{ animationDelay: "160ms" }}>
          <header>
            <h3>Weekly hours</h3>
            <DatePicker
              picker="month"
              value={dayjs(`${month}-01`)}
              onChange={(d) => d && setMonth(d.format("YYYY-MM"))}
              allowClear={false}
            />
          </header>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <AreaChart
                data={(data.weekChart || []).map((w) => ({
                  label: w.week,
                  hours: Number(w.worked || 0),
                }))}
              >
                <defs>
                  <linearGradient id="attFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FF5B22" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#FF5B22" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8edf5" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 12, fill: "#64748b" }} />
                <Tooltip />
                <Area type="monotone" dataKey="hours" stroke="#FF5B22" fill="url(#attFill)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      <section className="emp-att-table-card ad-enter" style={{ animationDelay: "200ms" }}>
        <div className="emp-att-filters">
          <RangePicker value={range} onChange={setRange} />
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 150 }}
            options={[
              { value: "all", label: "Select Status" },
              { value: "Present", label: "Present" },
              { value: "Half Day", label: "Half Day" },
              { value: "Absent", label: "Absent" },
              { value: "OFF", label: "OFF" },
            ]}
          />
          <Select
            value={sortBy}
            onChange={setSortBy}
            style={{ width: 150 }}
            options={[
              { value: "date-desc", label: "Sort By: Newest" },
              { value: "date-asc", label: "Sort By: Oldest" },
              { value: "hours-desc", label: "Hours High" },
              { value: "hours-asc", label: "Hours Low" },
            ]}
          />
          <Select
            value={pageSize}
            onChange={setPageSize}
            style={{ width: 130 }}
            options={[
              { value: 10, label: "10 / page" },
              { value: 20, label: "20 / page" },
              { value: 50, label: "50 / page" },
            ]}
          />
          <Input.Search
            placeholder="Search"
            allowClear
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 180, marginLeft: "auto" }}
          />
        </div>

        <Table
          rowKey="date"
          columns={columns}
          dataSource={tableRows}
          loading={loading}
          pagination={{ pageSize, showSizeChanger: false }}
          scroll={{ x: 960 }}
          size="middle"
        />
      </section>
    </div>
  );
}
