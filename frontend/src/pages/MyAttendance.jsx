import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  App as AntApp,
  Button,
  DatePicker,
  Form,
  Input,
  Progress,
  Select,
  Spin,
  Table,
  Tag,
} from "antd";
import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import api from "../api";

const TYPES = [
  { value: "casual", label: "Casual Leave" },
  { value: "annual", label: "Annual Leave" },
  { value: "sick", label: "Sick Leave" },
];

const STATUS_CLASS = {
  Present: "present",
  Late: "late",
  Early: "early",
  "Half Day": "half",
  Absent: "absent",
  OFF: "off",
  Leave: "leave",
  Missing: "missing",
  "Schedule Days": "off",
};

const WORKDAY_CUTOFF = "08:00:00";

function to12h(time) {
  if (!time) return "—";
  const [h, m, s] = String(time).split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, "0")}:${String(s || 0).padStart(2, "0")} ${ampm}`;
}

function clockLabel(hours) {
  const total = Math.max(0, Math.round((hours || 0) * 60));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function workDateFor(log) {
  if ((log.time || "00:00:00") < WORKDAY_CUTOFF) return addDays(log.date, -1);
  return log.date;
}

function formatDay(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${days[d.getDay()]}, ${String(d.getDate()).padStart(2, "0")}-${months[d.getMonth()]}-${d.getFullYear()}`;
}

function hoursBetween(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const [ih, im, is] = checkIn.split(":").map(Number);
  const [oh, om, os] = checkOut.split(":").map(Number);
  let start = ih * 60 + im + (is || 0) / 60;
  let end = oh * 60 + om + (os || 0) / 60;
  if (end < start) end += 24 * 60;
  return Math.max(0, (end - start) / 60);
}

function daysFromLogs(logs) {
  const map = new Map();
  for (const log of logs) {
    const workDate = workDateFor(log);
    if (!map.has(workDate)) map.set(workDate, []);
    map.get(workDate).push(log);
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([fullDate, punches]) => {
      const sorted = [...punches].sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
      const checkIn = sorted[0]?.time || null;
      const checkOut = sorted.length > 1 ? sorted.at(-1).time : null;
      const hours = Math.min(hoursBetween(checkIn, checkOut), 16);
      return {
        fullDate,
        checkIn,
        checkOut,
        hours,
        status: hours >= 9 ? "Present" : hours > 0 ? "Half Day" : "Absent",
      };
    });
}

export default function MyAttendance() {
  const { message } = AntApp.useApp();
  const [form] = Form.useForm();
  const [logs, setLogs] = useState([]);
  const [days, setDays] = useState([]);
  const [balances, setBalances] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("logs");

  async function load() {
    setLoading(true);
    try {
      const logRes = await api.get("/attendance/logs").catch(() => ({ data: { logs: [] } }));
      const logsList = logRes.data?.logs || [];
      setLogs(logsList);
      try {
        const { data: dash } = await api.get("/dashboard/summary");
        const chartDays = (dash.flagChart || []).filter((d) => d.status !== "Schedule Days").reverse();
        setDays(chartDays.length ? chartDays : daysFromLogs(logsList));
      } catch {
        setDays(daysFromLogs(logsList));
      }
      const [{ data: b }, { data: r }] = await Promise.all([
        api.get("/leaves/balances").catch(() => ({ data: { balances: [] } })),
        api.get("/leaves").catch(() => ({ data: { requests: [] } })),
      ]);
      setBalances(b.balances || []);
      setRequests(r.requests || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch((err) => message.error(err.response?.data?.message || "Could not load attendance"));
    const timer = setInterval(() => load().catch(() => {}), 20000);
    return () => clearInterval(timer);
  }, []);

  const punchesByDay = useMemo(() => {
    const map = new Map();
    for (const log of logs) {
      const workDate = workDateFor(log);
      if (!map.has(workDate)) map.set(workDate, []);
      map.get(workDate).push(log);
    }
    for (const list of map.values()) {
      list.sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
    }
    return map;
  }, [logs]);

  const stats = useMemo(() => {
    const s = { Present: 0, Late: 0, Absent: 0, Leave: 0, "Half Day": 0, OFF: 0 };
    for (const d of days) {
      if (s[d.status] != null) s[d.status] += 1;
      else if (d.status === "Early") s.Present += 1;
    }
    return s;
  }, [days]);

  async function onFinish(values) {
    setSaving(true);
    try {
      await api.post("/leaves", {
        type: values.type,
        fromDate: values.range[0].format("YYYY-MM-DD"),
        toDate: values.range[1].format("YYYY-MM-DD"),
        reason: values.reason || "",
      });
      message.success("Leave request submitted");
      form.resetFields();
      await load();
      setTab("leaves");
    } catch (err) {
      message.error(err.response?.data?.message || "Could not apply leave");
    } finally {
      setSaving(false);
    }
  }

  if (loading && !days.length) {
    return (
      <div className="ma-boot">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="ma-page">
      <section className="ma-hero ma-enter">
        <div>
          <h1><CalendarOutlined /> My Attendance</h1>
          <p>Daily punches, hours, and leave requests — Softnox workday (8:00 AM cutoff)</p>
        </div>
        <Link to="/info" className="ma-hero-link">My Info →</Link>
      </section>

      <section className="ma-kpis">
        {[
          { label: "Present", value: stats.Present, tone: "green", icon: <CheckCircleOutlined /> },
          { label: "Late", value: stats.Late, tone: "amber", icon: <ClockCircleOutlined /> },
          { label: "Half day", value: stats["Half Day"], tone: "orange", icon: <ClockCircleOutlined /> },
          { label: "Absent", value: stats.Absent, tone: "red", icon: <CloseCircleOutlined /> },
          { label: "On leave", value: stats.Leave, tone: "blue", icon: <CalendarOutlined /> },
        ].map((k, i) => (
          <article key={k.label} className={`ma-kpi tone-${k.tone} ma-enter`} style={{ animationDelay: `${40 + i * 40}ms` }}>
            <div className="ma-kpi-icon">{k.icon}</div>
            <div>
              <span>{k.label}</span>
              <strong>{k.value}</strong>
              <small>this month</small>
            </div>
          </article>
        ))}
      </section>

      <div className="ma-tabs ma-enter" style={{ animationDelay: "180ms" }}>
        <button type="button" className={tab === "logs" ? "active" : ""} onClick={() => setTab("logs")}>
          Daily Attendance <em>{days.length}</em>
        </button>
        <button type="button" className={tab === "leaves" ? "active" : ""} onClick={() => setTab("leaves")}>
          Leaves <em>{requests.length}</em>
        </button>
      </div>

      {tab === "logs" && (
        <section className="ma-panel ma-enter" key="logs" style={{ animationDelay: "220ms" }}>
          <div className="ma-note">
            <i />
            <span>
              Har row ek office day hai (8:00 AM se next day 7:59 AM). Time In pehli punch, Time Out last punch.
              Row expand karke saari machine punches dekho.
            </span>
          </div>
          <Table
            className="emp-table soft-card ma-table"
            rowKey="fullDate"
            loading={loading}
            dataSource={days}
            pagination={{ pageSize: 12, showSizeChanger: false, showTotal: (t) => `${t} days` }}
            expandable={{
              expandedRowRender: (row) => {
                const punches = punchesByDay.get(row.fullDate) || [];
                if (!punches.length) {
                  return <div className="ma-empty-expand">Is din koi machine punch nahi mili.</div>;
                }
                return (
                  <div className="ma-punches">
                    {punches.map((p) => (
                      <div key={p._id || `${p.date}-${p.time}`} className="ma-punch-chip">
                        <Tag className={p.type === 1 ? "ma-tag in" : "ma-tag out"}>
                          {p.type === 1 ? "Check In" : "Check Out"}
                        </Tag>
                        <b>{to12h(p.time)}</b>
                        <small>Machine {p.machineId || "—"} · {p.ip || "—"}</small>
                      </div>
                    ))}
                  </div>
                );
              },
              rowExpandable: () => true,
            }}
            columns={[
              {
                title: "Date",
                dataIndex: "fullDate",
                render: (d) => <span className="ma-date">{formatDay(d)}</span>,
                width: 200,
              },
              { title: "Time In", dataIndex: "checkIn", render: to12h, width: 140 },
              { title: "Time Out", dataIndex: "checkOut", render: to12h, width: 140 },
              {
                title: "Hours",
                dataIndex: "hours",
                width: 90,
                render: (h) => <b className="ma-hours">{clockLabel(h)}</b>,
              },
              {
                title: "Status",
                dataIndex: "status",
                width: 130,
                render: (s) => <Tag className={`ma-status ${STATUS_CLASS[s] || "off"}`}>{s}</Tag>,
              },
              {
                title: "Punches",
                key: "punches",
                width: 90,
                render: (_, row) => (
                  <span className="ma-punch-count">{punchesByDay.get(row.fullDate)?.length || 0}</span>
                ),
              },
            ]}
          />
        </section>
      )}

      {tab === "leaves" && (
        <div className="ma-leaves ma-enter" key="leaves" style={{ animationDelay: "220ms" }}>
          {requests.some((r) => r.status === "approved") && (
            <div className="ma-alert ok">
              <CheckCircleOutlined /> Admin ne leave approve kar di hai
            </div>
          )}

          <div className="ma-bal-grid">
            {balances.map((b) => (
              <article key={b.type} className="ma-bal">
                <span>{b.label}</span>
                <strong>{Number(b.balance).toFixed(1)}</strong>
                <Progress
                  percent={Math.min(100, (Number(b.balance) / (b.type === "annual" ? 14 : b.type === "sick" ? 8 : 10)) * 100)}
                  showInfo={false}
                  size="small"
                  strokeColor={b.type === "sick" ? "#f59e0b" : b.type === "annual" ? "#7c3aed" : "#2563eb"}
                  trailColor="#eef2f7"
                />
              </article>
            ))}
          </div>

          <div className="ma-leaves-grid">
            <section className="ma-panel">
              <header className="ma-panel-head">
                <h3>Apply leave</h3>
                <PlusOutlined className="muted" />
              </header>
              <Form form={form} layout="vertical" className="ma-form" onFinish={onFinish} initialValues={{ type: "casual" }}>
                <Form.Item name="type" label="Leave type" rules={[{ required: true }]}>
                  <Select options={TYPES} />
                </Form.Item>
                <Form.Item name="range" label="From / To" rules={[{ required: true, message: "Select dates" }]}>
                  <DatePicker.RangePicker style={{ width: "100%" }} />
                </Form.Item>
                <Form.Item name="reason" label="Reason">
                  <Input.TextArea rows={3} placeholder="Optional note for admin…" />
                </Form.Item>
                <Button type="primary" htmlType="submit" loading={saving} className="ma-submit" block>
                  Submit leave request
                </Button>
              </Form>
            </section>

            <section className="ma-panel">
              <header className="ma-panel-head">
                <h3>My leave requests</h3>
                <span className="muted">{requests.length} total</span>
              </header>
              <Table
                className="emp-table soft-card ma-table"
                rowKey="_id"
                loading={loading}
                dataSource={requests}
                pagination={{ pageSize: 8, showTotal: (t) => `${t} requests` }}
                columns={[
                  {
                    title: "Type",
                    dataIndex: "type",
                    render: (v) => <Tag className="ma-leave-type">{v?.[0]?.toUpperCase() + v?.slice(1)}</Tag>,
                  },
                  { title: "From", dataIndex: "fromDate" },
                  { title: "To", dataIndex: "toDate" },
                  { title: "Days", dataIndex: "days", width: 70 },
                  { title: "Reason", dataIndex: "reason", ellipsis: true },
                  {
                    title: "Status",
                    dataIndex: "status",
                    render: (s) => <Tag className={`ma-leave-status ${s}`}>{s}</Tag>,
                  },
                ]}
              />
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
