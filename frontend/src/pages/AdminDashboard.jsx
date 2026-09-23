import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  App as AntApp,
  Avatar,
  Button,
  DatePicker,
  Dropdown,
  Input,
  Select,
  Spin,
  Tag,
  Upload,
} from "antd";
import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  PaperClipOutlined,
  GiftOutlined,
  HomeOutlined,
  NotificationOutlined,
  PlusOutlined,
  TeamOutlined,
  TrophyOutlined,
  UserAddOutlined,
  UserDeleteOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import dayjs from "dayjs";
import api, { openAnnouncementPdf } from "../api";
import LeaveDetailModal from "../components/LeaveDetailModal";
import { useAuth } from "../context/AuthContext";

const { RangePicker } = DatePicker;

const EVENT_ICONS = {
  "Work Anniversary": { icon: <TrophyOutlined />, tone: "amber" },
  Birthday: { icon: <GiftOutlined />, tone: "purple" },
  default: { icon: <CalendarOutlined />, tone: "blue" },
};

function initials(name = "") {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "?";
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      <b>{label}</b>
      <div>{payload[0].value}{payload[0].dataKey === "rate" || payload[0].unit === "%" ? "%" : ""}</div>
    </div>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const { message, modal } = AntApp.useApp();
  const navigate = useNavigate();
  const [range, setRange] = useState([dayjs().startOf("month"), dayjs()]);
  const [emp, setEmp] = useState();
  const [period, setPeriod] = useState("month");
  const [dept, setDept] = useState("all");
  const [attRange, setAttRange] = useState("6m");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const isHr = Boolean(user?.isHr);
  const base = isHr ? "/hr" : "/admin";
  const firstName = (user?.name || "Admin").split(" ")[0];
  const [hrQueue, setHrQueue] = useState({ pending: [], withAdmin: 0, docs: [] });
  const [announcements, setAnnouncements] = useState([]);
  const [annTitle, setAnnTitle] = useState("");
  const [annBody, setAnnBody] = useState("");
  const [annFrom, setAnnFrom] = useState(null);
  const [annTo, setAnnTo] = useState(null);
  const [annPdf, setAnnPdf] = useState(null);
  const [annPdfName, setAnnPdfName] = useState("");
  const [annSaving, setAnnSaving] = useState(false);
  const [editingAnnId, setEditingAnnId] = useState(null);
  const [leaveDetail, setLeaveDetail] = useState(null);
  const [leaveActing, setLeaveActing] = useState();
  const [queueTick, setQueueTick] = useState(0);

  async function load() {
    setLoading(true);
    try {
      const { data: res } = await api.get("/admin/dashboard");
      setData(res);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(() => {});
  }, []);

  useEffect(() => {
    if (!isHr) return;
    (async () => {
      try {
        const [leaves, people, notes] = await Promise.all([
          api.get("/admin/leaves", { params: { status: "pending" } }),
          api.get("/admin/employees"),
          api.get("/admin/announcements"),
        ]);
        setAnnouncements(notes.data.announcements || []);
        const docs = (people.data.employees || [])
          .map((empRow) => {
            const items = Array.isArray(empRow.documentItems) ? empRow.documentItems : [];
            const missing = items.filter((d) => d?.name && !d.received).map((d) => d.name);
            return missing.length ? { ...empRow, missing } : null;
          })
          .filter(Boolean)
          .slice(0, 6);
        setHrQueue({
          pending: leaves.data.requests || [],
          withAdmin: leaves.data.counts?.hr_approved || 0,
          docs,
        });
      } catch {
        setHrQueue({ pending: [], withAdmin: 0, docs: [] });
      }
    })();
  }, [isHr, queueTick]);

  const kpis = useMemo(() => {
    const k = data?.kpis || {};
    const total = k.totalEmployees || 0;
    return [
      { key: "employees", label: "Total Employees", value: String(total), hint: "active employees", delta: `${total}`, up: true, icon: <TeamOutlined />, tone: "blue" },
      { key: "present", label: "Present Today", value: String(k.presentToday || 0), hint: "of total", delta: `${k.presentPct || 0}%`, icon: <CheckCircleOutlined />, tone: "green" },
      { key: "absent", label: "Absent Today", value: String(k.absentToday || 0), hint: "of total", delta: `${k.absentPct || 0}%`, icon: <CloseCircleOutlined />, tone: "red" },
      { key: "leave", label: "On Leave", value: String(k.onLeave || 0), hint: "of total", delta: `${k.leavePct || 0}%`, icon: <CalendarOutlined />, tone: "amber" },
      { key: "late", label: "Late Arrivals", value: String(k.lateArrivals || 0), hint: "of total", delta: `${k.latePct || 0}%`, icon: <ClockCircleOutlined />, tone: "orange" },
      { key: "wfh", label: "Work From Home", value: String(k.workFromHome || 0), hint: "of total", delta: "0%", icon: <HomeOutlined />, tone: "purple" },
      { key: "hires", label: "New Hires (This Month)", value: String(k.newHires || 0), hint: "joined this month", delta: `+${k.newHires || 0}`, up: true, icon: <UserAddOutlined />, tone: "cyan" },
      { key: "exit", label: "Exiting (This Month)", value: String(k.exiting || 0), hint: "this month", delta: "0", up: false, icon: <UserDeleteOutlined />, tone: "rose" },
    ];
  }, [data]);

  const empOptions = useMemo(
    () => (data?.employeeOptions || []).map((e) => ({
      value: e.id,
      label: e.name,
      employee: e,
    })),
    [data],
  );

  const donut = data?.attendanceOverview?.length
    ? data.attendanceOverview
    : [{ name: "No punches yet", value: 1, color: "#cbd5e1" }];

  const presentPct = data?.kpis?.presentPct ?? 0;
  const depts = (data?.workforce?.byDepartment || []).slice(0, 8);
  const byRole = data?.workforce?.byRole || [];
  const byTeam = data?.workforce?.byTeam || [];
  const headcount = data?.workforce?.headcountTrend || [];
  const whosIn = data?.whosIn || [];
  const birthdays = data?.birthdays || [];
  const events = data?.upcomingEvents || [];
  const productivity = data?.productivity || {};

  function openEmp(empId, e) {
    e?.stopPropagation?.();
    if (!empId) return;
    navigate(`${base}/employees/${empId}`);
  }

  async function decideLeave(id, next) {
    setLeaveActing(id);
    try {
      await api.patch(`/leaves/${id}`, { status: next });
      message.success(next === "rejected" ? "Leave rejected" : "Sent to Admin for final approval");
      setLeaveDetail(null);
      setQueueTick((n) => n + 1);
    } catch (err) {
      message.error(err.response?.data?.message || "Update failed");
    } finally {
      setLeaveActing(undefined);
    }
  }

  function EmpDp({ empId, name, color, size = 30, title }) {
    return (
      <button
        type="button"
        className="ad-dp-btn"
        title={title || `Open ${name}`}
        onClick={(ev) => openEmp(empId, ev)}
      >
        <Avatar size={size} style={{ background: color || hashColorFallback(empId) }}>
          {initials(name)}
        </Avatar>
      </button>
    );
  }

  function hashColorFallback(id) {
    const palette = ["#2563eb", "#db2777", "#0f766e", "#7c3aed", "#d97706", "#0891b2", "#16a34a"];
    let hash = 0;
    for (const ch of String(id || "")) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return palette[hash % palette.length];
  }

  const attTrend = useMemo(() => {
    // Derive a soft trend from current attendance rate for visualization until history API exists
    const rate = productivity.attendanceRate || 0;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const now = new Date().getMonth();
    return Array.from({ length: 9 }, (_, i) => {
      const idx = (now - 8 + i + 12) % 12;
      const wobble = ((i % 3) - 1) * 1.2;
      return { month: months[idx], rate: Math.max(0, Math.min(100, Number((rate + wobble).toFixed(1)))) };
    });
  }, [productivity.attendanceRate]);

  const quickItems = isHr
    ? [
        { key: "add", label: "Add Employee" },
        { key: "leave", label: "Approve Leaves" },
        { key: "att", label: "View Attendance" },
        { key: "emp", label: "View Employees" },
      ]
    : [
        { key: "emp", label: "View Employees" },
        { key: "leave", label: "Approve Leaves" },
        { key: "att", label: "View Attendance" },
      ];

  const employeeAnnouncements = announcements.filter((a) => a.audience !== "admin");
  const latestAnn = employeeAnnouncements[0];

  if (loading && !data) {
    return (
      <div className="boot" style={{ minHeight: 320 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="admin-dash">
      <section className="ad-hero">
        <div className="ad-hello ad-enter" style={{ animationDelay: "40ms" }}>
          <h1>
            {greeting()}, {firstName}! <span aria-hidden>👋</span>
          </h1>
          <p>{isHr ? "Approve leave first, add employees, and keep documents in order." : "Here's what's happening in your organization today."}</p>
        </div>
        <div className="ad-hero-actions ad-enter" style={{ animationDelay: "90ms" }}>
          <RangePicker value={range} onChange={(v) => v && setRange(v)} allowClear={false} className="ad-range" />
          <Select
            allowClear
            showSearch
            value={emp}
            onChange={(id) => {
              setEmp(id);
              if (id) navigate(`${base}/employees/${id}`);
            }}
            placeholder="Select Employee"
            prefix={<UserOutlined />}
            className="ad-emp-select"
            optionFilterProp="label"
            options={empOptions}
            optionRender={(option) => {
              const e = option.data?.employee;
              if (!e) return option.label;
              return (
                <div className="ad-emp-option">
                  <Avatar size={36} style={{ background: e.color, flexShrink: 0 }}>{initials(e.name)}</Avatar>
                  <div>
                    <b>{e.name}</b>
                    <small>{e.id} · {e.role}</small>
                  </div>
                </div>
              );
            }}
            dropdownRender={(menu) => (
              <>
                {menu}
                <button type="button" className="ad-emp-footer" onClick={() => navigate(`${base}/employees`)}>
                  View All Employees →
                </button>
              </>
            )}
          />
          <Dropdown
            menu={{
              items: quickItems,
              onClick: ({ key }) => {
                if (key === "add") navigate("/hr/employees/new");
                else if (key === "leave") navigate(`${base}/leaves`);
                else if (key === "att") navigate(`${base}/attendance`);
                else if (key === "emp") navigate(`${base}/employees`);
              },
            }}
          >
            <Button type="primary" className="ad-quick" icon={<PlusOutlined />}>
              Quick Action
            </Button>
          </Dropdown>
        </div>
      </section>

      <section className="ad-kpis">
        {kpis.map((k, i) => (
          <article key={k.key} className={`ad-kpi ad-enter tone-${k.tone}`} style={{ animationDelay: `${120 + i * 55}ms` }}>
            <div className="ad-kpi-icon">{k.icon}</div>
            <div className="ad-kpi-copy">
              <span>{k.label}</span>
              <strong>{k.value}</strong>
              <small className={k.up === false ? "down" : k.up ? "up" : ""}>
                {k.delta} {k.hint}
              </small>
            </div>
          </article>
        ))}
      </section>

      {isHr ? (
        <>
        <section className="ad-bottom">
          <article className="ad-panel ad-enter" style={{ animationDelay: "480ms" }}>
            <header className="ad-panel-head">
              <h3>Leave requests for you</h3>
              <button type="button" className="ad-link" onClick={() => navigate("/hr/leaves")}>Open queue →</button>
            </header>
            <ul className="ad-who">
              {hrQueue.pending.length === 0 && <li className="muted" style={{ display: "block", padding: 16 }}>No new leave requests.</li>}
              {hrQueue.pending.slice(0, 6).map((row) => (
                <li key={row._id} className="ad-who-click" onClick={() => setLeaveDetail(row)}>
                  <div className="ad-who-emp">
                    <button type="button" className="ad-name-link" onClick={() => setLeaveDetail(row)}>
                      <b>{row.employeeName}</b>
                      <small>{row.type} · {row.days} day(s)</small>
                    </button>
                  </div>
                  <span className="muted">{row.fromDate}</span>
                  <span className="ad-mono">{row.toDate}</span>
                  <Tag className="ad-tag late">With HR</Tag>
                </li>
              ))}
            </ul>
          </article>

          <article className="ad-panel ad-enter" style={{ animationDelay: "540ms" }}>
            <header className="ad-panel-head">
              <h3>Waiting for Admin</h3>
              <button type="button" className="ad-link" onClick={() => navigate("/hr/leaves")}>View leaves →</button>
            </header>
            <div className="ad-need-chips">
              <article>
                <span>With HR</span>
                <strong>{hrQueue.pending.length}</strong>
              </article>
              <article>
                <span>With Admin</span>
                <strong>{hrQueue.withAdmin}</strong>
              </article>
              <article>
                <span>Docs open</span>
                <strong>{hrQueue.docs.length}</strong>
              </article>
            </div>
            <p className="muted" style={{ margin: "12px 0 0" }}>You approve first. Admin gives the final approval.</p>
            <Button type="primary" icon={<UserAddOutlined />} style={{ marginTop: 14 }} onClick={() => navigate("/hr/employees/new")}>
              Add Employee
            </Button>
          </article>

          <article className="ad-panel ad-enter" style={{ animationDelay: "600ms" }}>
            <header className="ad-panel-head">
              <h3><FileTextOutlined /> Document checklist</h3>
              <button type="button" className="ad-link" onClick={() => navigate("/hr/employees")}>All employees →</button>
            </header>
            <ul className="ad-need-list">
              {hrQueue.docs.length === 0 && <li className="muted" style={{ display: "block", padding: 12 }}>No open document checks.</li>}
              {hrQueue.docs.map((row) => (
                <li key={row.empId}>
                  <button type="button" className="ad-name-link" onClick={() => openEmp(row.empId)}>
                    <b>{row.name}</b>
                    <small>{row.missing.join(" · ")} missing</small>
                  </button>
                </li>
              ))}
            </ul>
          </article>
        </section>

        <article className="ad-panel hr-ann-panel ad-enter" style={{ animationDelay: "640ms" }}>
          <header className="ad-panel-head">
            <h3><NotificationOutlined /> Announcements</h3>
            <button type="button" className="ad-link" onClick={() => navigate("/hr/announcements")}>Manage →</button>
          </header>
          <div className="hr-ann-body">
            <div className="hr-ann-form">
              <p className="hr-ann-kicker">{editingAnnId ? "Edit post" : "New post"}</p>
              <p className="muted">Employees see this on their dashboard and in the bell.</p>
              <Input
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
                placeholder="Title"
                maxLength={120}
              />
              <Input.TextArea
                value={annBody}
                onChange={(e) => setAnnBody(e.target.value)}
                placeholder="Write the announcement for employees"
                rows={4}
                maxLength={2000}
              />
              <div className="hr-ann-dates">
                <DatePicker
                  value={annFrom}
                  onChange={(value) => {
                    setAnnFrom(value);
                    if (value && annTo && annTo.isBefore(value, "day")) setAnnTo(value);
                  }}
                  format="DD MMM YYYY"
                  placeholder="Show from"
                  style={{ width: "100%" }}
                />
                <DatePicker
                  value={annTo}
                  onChange={setAnnTo}
                  format="DD MMM YYYY"
                  placeholder="Show until"
                  style={{ width: "100%" }}
                  disabledDate={(current) => (annFrom ? current && current.isBefore(annFrom, "day") : false)}
                />
              </div>
              <p className="muted">After the end date, the post and its notification are removed automatically.</p>
              <div className="hr-ann-pdf">
                <Upload
                  accept="application/pdf,.pdf"
                  maxCount={1}
                  showUploadList={false}
                  beforeUpload={(file) => {
                    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
                    if (!isPdf) {
                      message.error("Only PDF allowed");
                      return false;
                    }
                    if (file.size > 4 * 1024 * 1024) {
                      message.error("PDF must be under 4 MB");
                      return false;
                    }
                    const reader = new FileReader();
                    reader.onload = () => {
                      setAnnPdf({ name: file.name, data: String(reader.result || "") });
                      setAnnPdfName(file.name);
                    };
                    reader.readAsDataURL(file);
                    return false;
                  }}
                >
                  <Button icon={<PaperClipOutlined />}>Upload PDF</Button>
                </Upload>
                <em>{annPdfName || "No PDF. Policy files must be PDF."}</em>
                {annPdfName ? (
                  <button type="button" className="hr-ann-cancel" onClick={() => { setAnnPdf({ name: "", data: "" }); setAnnPdfName(""); }}>
                    Remove PDF
                  </button>
                ) : null}
              </div>
              <Button
                type="primary"
                loading={annSaving}
                onClick={async () => {
                  const title = annTitle.trim();
                  const body = annBody.trim();
                  if (!title || !body) return;
                  if (!annFrom || !annTo) {
                    message.error("Choose a show from date and a show until date.");
                    return;
                  }
                  const payload = {
                    title,
                    body,
                    audience: "employees",
                    startDate: annFrom.format("YYYY-MM-DD"),
                    endDate: annTo.format("YYYY-MM-DD"),
                  };
                  if (annPdf) {
                    payload.documentName = annPdf.name;
                    payload.documentData = annPdf.data;
                  }
                  setAnnSaving(true);
                  try {
                    if (editingAnnId) {
                      await api.patch(`/admin/announcements/${editingAnnId}`, payload);
                      message.success("Announcement updated");
                    } else {
                      await api.post("/admin/announcements", payload);
                      message.success("Announcement published");
                    }
                    setAnnTitle("");
                    setAnnBody("");
                    setAnnFrom(null);
                    setAnnTo(null);
                    setAnnPdf(null);
                    setAnnPdfName("");
                    setEditingAnnId(null);
                    const { data: notes } = await api.get("/admin/announcements");
                    setAnnouncements(notes.announcements || []);
                  } catch (err) {
                    message.error(err.response?.data?.message || "Could not save announcement");
                  } finally {
                    setAnnSaving(false);
                  }
                }}
              >
                {editingAnnId ? "Save changes" : "Publish to employees"}
              </Button>
              {editingAnnId ? (
                <button
                  type="button"
                  className="hr-ann-cancel"
                  onClick={() => {
                    setEditingAnnId(null);
                    setAnnTitle("");
                    setAnnBody("");
                    setAnnFrom(null);
                    setAnnTo(null);
                    setAnnPdf(null);
                    setAnnPdfName("");
                  }}
                >
                  Cancel edit
                </button>
              ) : null}
            </div>
            <div className="hr-ann-side">
              <p className="hr-ann-kicker">Employee preview</p>
              <article className="hr-ann-preview">
                <span className="hr-ann-preview-dot" />
                <div>
                  <b>{annTitle.trim() || latestAnn?.title || "Announcement title"}</b>
                  <p>{annBody.trim() || latestAnn?.body || "Your message will show here, the same way employees see it."}</p>
                  <small>
                    {annFrom && annTo
                      ? `${annFrom.format("DD MMM YYYY")} → ${annTo.format("DD MMM YYYY")}`
                      : annTitle.trim() || annBody.trim()
                        ? "Draft · pick show from and show until"
                        : "Latest live post"}
                  </small>
                </div>
              </article>
              <ul className="hr-ann-list">
                {employeeAnnouncements.slice(0, 5).map((a) => (
                  <li key={a._id} className={editingAnnId === a._id ? "is-editing" : ""}>
                    <b>{a.title}</b>
                    <small>{a.body}</small>
                    <em>
                      {a.startDate && a.endDate
                        ? `${dayjs(a.startDate).format("DD MMM YYYY")} → ${dayjs(a.endDate).format("DD MMM YYYY")}`
                        : a.createdAt ? dayjs(a.createdAt).format("DD MMM YYYY") : ""}
                    </em>
                    {a.documentName ? (
                      <button type="button" className="hr-ann-pdf-link" onClick={() => openAnnouncementPdf(a._id)}>
                        <PaperClipOutlined /> {a.documentName}
                      </button>
                    ) : null}
                    <div className="hr-ann-actions">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingAnnId(a._id);
                          setAnnTitle(a.title || "");
                          setAnnBody(a.body || "");
                          setAnnFrom(a.startDate ? dayjs(a.startDate) : null);
                          setAnnTo(a.endDate ? dayjs(a.endDate) : null);
                          setAnnPdf(null);
                          setAnnPdfName(a.documentName || "");
                        }}
                      >
                        <EditOutlined /> Edit
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => {
                          modal.confirm({
                            title: "Delete this announcement?",
                            content: "This post will be removed from HR, employees, and the notification bell.",
                            okText: "Delete",
                            okButtonProps: { danger: true },
                            cancelText: "Cancel",
                            onOk: async () => {
                              await api.delete(`/admin/announcements/${a._id}`);
                              if (editingAnnId === a._id) {
                                setEditingAnnId(null);
                                setAnnTitle("");
                                setAnnBody("");
                                setAnnFrom(null);
                                setAnnTo(null);
                              }
                              setAnnouncements((list) => list.filter((item) => item._id !== a._id));
                              message.success("Announcement deleted");
                            },
                          });
                        }}
                      >
                        <DeleteOutlined /> Delete
                      </button>
                    </div>
                  </li>
                ))}
                {!employeeAnnouncements.length && <li className="muted">No announcements yet.</li>}
              </ul>
            </div>
          </div>
        </article>
        </>
      ) : null}

      <section className="ad-bottom">
        <article className="ad-panel ad-enter" style={{ animationDelay: "560ms" }}>
          <header className="ad-panel-head">
            <h3>Attendance Overview (Today)</h3>
          </header>
          <div className="ad-overview-body">
            <div className="ad-donut-wrap">
              <div className="ad-donut">
                <ResponsiveContainer width={140} height={140}>
                  <PieChart width={140} height={140}>
                    <Pie data={donut} dataKey="value" cx={70} cy={70} innerRadius={46} outerRadius={64} paddingAngle={2} stroke="none" animationDuration={900}>
                      {donut.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="ad-donut-center">
                  <b>{presentPct}%</b>
                  <span>Present</span>
                </div>
              </div>
              <ul className="ad-legend">
                {donut.map((d) => {
                  const total = Math.max(1, data?.kpis?.totalEmployees || donut.reduce((s, x) => s + x.value, 0));
                  const share = (d.value / total) * 100;
                  const pct = Math.abs(share - Math.round(share)) < 0.08 ? `${Math.round(share)}%` : `${share.toFixed(1)}%`;
                  return (
                    <li key={d.name}>
                      <i style={{ background: d.color }} />
                      <span>{d.name}</span>
                      <em>{d.value} ({pct})</em>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="ad-overview-chips">
              <article>
                <span>Present</span>
                <strong>{data?.kpis?.presentToday || 0}</strong>
              </article>
              <article>
                <span>Absent</span>
                <strong>{data?.kpis?.absentToday || 0}</strong>
              </article>
              <article>
                <span>On Leave</span>
                <strong>{data?.kpis?.onLeave || 0}</strong>
              </article>
            </div>
          </div>
        </article>

        <article className="ad-panel ad-enter" style={{ animationDelay: "640ms" }}>
          <header className="ad-panel-head">
            <h3>Who&apos;s In Today?</h3>
            <button type="button" className="ad-link" onClick={() => navigate(`${base}/attendance`)}>View All →</button>
          </header>
          <div className="ad-table-head">
            <span>Employee</span>
            <span>Department</span>
            <span>Check In</span>
            <span>Status</span>
          </div>
          <ul className="ad-who">
            {whosIn.length === 0 && <li className="muted" style={{ display: "block", padding: 16 }}>No check-ins for today yet.</li>}
            {whosIn.slice(0, 7).map((row) => (
              <li key={row.empId}>
                <div className="ad-who-emp">
                  <EmpDp empId={row.empId} name={row.name} color={row.color} size={30} />
                  <button type="button" className="ad-name-link" onClick={() => openEmp(row.empId)}>
                    <b>{row.name}</b>
                  </button>
                </div>
                <span className="muted">{row.department}</span>
                <span className="ad-mono">{row.checkInLabel || "—"}</span>
                <Tag className={row.status === "Late" ? "ad-tag late" : "ad-tag present"}>{row.status}</Tag>
              </li>
            ))}
          </ul>
        </article>

        <article className="ad-panel ad-enter" style={{ animationDelay: "720ms" }}>
          <header className="ad-panel-head">
            <h3>Needs Attention</h3>
            <button type="button" className="ad-link" onClick={() => navigate(`${base}/attendance`)}>View All →</button>
          </header>
          <div className="ad-need-chips">
            <article>
              <span>Late</span>
              <strong>{data?.kpis?.lateArrivals || whosIn.filter((w) => w.status === "Late").length}</strong>
            </article>
            <article>
              <span>Absent</span>
              <strong>{data?.kpis?.absentToday || 0}</strong>
            </article>
            <article>
              <span>Half Day</span>
              <strong>{whosIn.filter((w) => w.status === "Half Day").length}</strong>
            </article>
          </div>
          <ul className="ad-need-list">
            {whosIn
              .filter((w) => ["Late", "Half Day", "Absent", "Missing"].includes(w.status))
              .slice(0, 6)
              .map((row) => (
                <li key={`need-${row.empId}`}>
                  <EmpDp empId={row.empId} name={row.name} color={row.color} size={30} />
                  <button type="button" className="ad-name-link" onClick={() => openEmp(row.empId)}>
                    <b>{row.name}</b>
                    <small>{row.department}</small>
                  </button>
                  <Tag className={row.status === "Late" || row.status === "Absent" ? "ad-tag late" : "ad-tag present"}>
                    {row.status}
                  </Tag>
                </li>
              ))}
            {!whosIn.some((w) => ["Late", "Half Day", "Absent", "Missing"].includes(w.status)) && (
              <li className="muted" style={{ display: "block", padding: 12 }}>All clear for now.</li>
            )}
          </ul>
        </article>
      </section>

      <section className="ad-analytics-grid">
        <div className="ad-analytics-main">
          <article className="ad-panel ad-enter" style={{ animationDelay: "780ms" }}>
            <header className="ad-panel-head ad-panel-head-wrap">
              <h3>Workforce Analytics</h3>
              <div className="ad-filters">
                <div className="ad-seg">
                  {[
                    { key: "month", label: "This Month" },
                    { key: "3m", label: "Last 3 Months" },
                    { key: "year", label: "This Year" },
                  ].map((p) => (
                    <button key={p.key} type="button" className={period === p.key ? "active" : ""} onClick={() => setPeriod(p.key)}>
                      {p.label}
                    </button>
                  ))}
                </div>
                <Select
                  value={dept}
                  onChange={setDept}
                  className="ad-dept-select"
                  options={[
                    { value: "all", label: "All Departments" },
                    ...depts.map((d) => ({ value: d.name, label: d.name })),
                  ]}
                />
              </div>
            </header>

            <div className="ad-wf-grid">
              <div className="ad-chart-card">
                <h4>Headcount Trend</h4>
                <div className="ad-chart-box">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={headcount} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip content={<ChartTip />} />
                      <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={3} dot={{ r: 4, fill: "#2563eb", strokeWidth: 0 }} animationDuration={1000} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="ad-chart-card">
                <h4>Employees by Department</h4>
                <div className="ad-chart-box">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={(dept === "all" ? depts : depts.filter((d) => d.name === dept))}
                      layout="vertical"
                      margin={{ top: 4, right: 36, left: 4, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="deptBar" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#2563eb" />
                          <stop offset="100%" stopColor="#93c5fd" />
                        </linearGradient>
                      </defs>
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="name" width={110} tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v, _n, p) => [`${v} (${p.payload.pct}%)`, "Employees"]} cursor={{ fill: "rgba(37,99,235,0.06)" }} />
                      <Bar dataKey="count" fill="url(#deptBar)" radius={[0, 8, 8, 0]} barSize={12} animationDuration={900} label={{ position: "right", fill: "#64748b", fontSize: 11, formatter: (v) => v }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="ad-chart-card">
                <h4>Employment Role</h4>
                <div className="ad-mini-donut">
                  <div className="ad-donut sm">
                    <ResponsiveContainer width="100%" height={150}>
                      <PieChart>
                        <Pie data={byRole} dataKey="value" innerRadius={46} outerRadius={66} paddingAngle={2} stroke="none" animationDuration={900}>
                          {byRole.map((d) => (
                            <Cell key={d.name} fill={d.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="ad-donut-center">
                      <b>{data?.kpis?.totalEmployees || 0}</b>
                      <span>Employees</span>
                    </div>
                  </div>
                  <ul className="ad-legend compact">
                    {byRole.map((d) => (
                      <li key={d.name}>
                        <i style={{ background: d.color }} />
                        <span>{d.name}</span>
                        <em>{d.value}</em>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="ad-chart-card">
                <h4>Team / Branch</h4>
                <div className="ad-mini-donut">
                  <div className="ad-donut sm">
                    <ResponsiveContainer width="100%" height={150}>
                      <PieChart>
                        <Pie data={byTeam} dataKey="value" innerRadius={46} outerRadius={66} paddingAngle={2} stroke="none" animationDuration={900}>
                          {byTeam.map((d) => (
                            <Cell key={d.name} fill={d.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="ad-donut-center">
                      <b>{data?.kpis?.totalEmployees || 0}</b>
                      <span>Employees</span>
                    </div>
                  </div>
                  <ul className="ad-legend compact">
                    {byTeam.map((d) => (
                      <li key={d.name}>
                        <i style={{ background: d.color }} />
                        <span>{d.name}</span>
                        <em>{d.value}</em>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </article>

          <article className="ad-panel ad-enter" style={{ animationDelay: "860ms" }}>
            <header className="ad-panel-head">
              <h3>Attendance &amp; Productivity</h3>
            </header>
            <div className="ad-att-kpis">
              <div className="ad-att-kpi">
                <span>Attendance Rate</span>
                <strong>{productivity.attendanceRate || 0}%</strong>
                <small className="up">today</small>
              </div>
              <div className="ad-att-kpi">
                <span>Avg. Check-in Time</span>
                <strong>{productivity.avgCheckIn || "—"}</strong>
                <small className="up">today</small>
              </div>
              <div className="ad-att-kpi">
                <span>Avg. Working Hours</span>
                <strong>{productivity.avgHours ? `${productivity.avgHours} hrs` : "—"}</strong>
                <small className="up">today</small>
              </div>
              <div className="ad-att-kpi">
                <span>Overtime (This Month)</span>
                <strong>{productivity.overtimeHours || 0} hrs</strong>
                <small className="down">pending</small>
              </div>
            </div>

            <div className="ad-att-grid">
              <div className="ad-chart-card">
                <header className="ad-panel-head">
                  <h4>Attendance Rate Trend</h4>
                  <Select
                    value={attRange}
                    onChange={setAttRange}
                    size="small"
                    className="ad-mini-select"
                    options={[
                      { value: "6m", label: "Last 6 Months" },
                      { value: "12m", label: "Last 12 Months" },
                    ]}
                  />
                </header>
                <div className="ad-chart-box">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={attTrend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <defs>
                        <linearGradient id="attFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22c55e" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                      <Tooltip content={<ChartTip />} />
                      <Area type="monotone" dataKey="rate" stroke="#16a34a" strokeWidth={2.5} fill="url(#attFill)" animationDuration={1100} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="ad-chart-card">
                <header className="ad-panel-head">
                  <h4>Top Attendance Exceptions</h4>
                  <button type="button" className="ad-link" onClick={() => navigate(`${base}/attendance`)}>View All →</button>
                </header>
                <div className="ad-exc-head">
                  <span>Employee</span>
                  <span>Department</span>
                  <span>Status</span>
                </div>
                <ul className="ad-exc">
                  {whosIn.filter((w) => ["Late", "Half Day", "Absent"].includes(w.status)).slice(0, 5).map((row) => (
                    <li key={`ex-${row.empId}`}>
                      <div className="ad-who-emp">
                        <EmpDp empId={row.empId} name={row.name} color={row.color} size={32} />
                        <button type="button" className="ad-name-link" onClick={() => openEmp(row.empId)}>
                          <b>{row.name}</b>
                        </button>
                      </div>
                      <span className="muted">{row.department}</span>
                      <em className="ad-issues">{row.status}</em>
                    </li>
                  ))}
                  {!whosIn.some((w) => ["Late", "Half Day", "Absent"].includes(w.status)) && (
                    <li className="muted" style={{ display: "block", padding: 12 }}>No exceptions logged today.</li>
                  )}
                </ul>
              </div>
            </div>
          </article>
        </div>

        <aside className="ad-rail">
          <article className="ad-panel ad-enter" style={{ animationDelay: "820ms" }}>
            <header className="ad-panel-head">
              <h3>Upcoming Events</h3>
            </header>
            <ul className="ad-events">
              {events.length === 0 && <li className="muted" style={{ display: "block", padding: 8 }}>No events this month.</li>}
              {events.map((e) => {
                const meta = EVENT_ICONS[e.type] || EVENT_ICONS.default;
                return (
                  <li key={`${e.type}-${e.name}-${e.date}`}>
                    <span className={`ad-event-icon tone-${e.tone || meta.tone}`}>{meta.icon}</span>
                    <div>
                      <b>{e.type}</b>
                      <small>{e.detail}</small>
                    </div>
                    <em>{e.date}</em>
                  </li>
                );
              })}
            </ul>
          </article>

          <article className="ad-panel ad-enter" style={{ animationDelay: "900ms" }}>
            <header className="ad-panel-head">
              <h3>Birthdays This Month</h3>
            </header>
            <ul className="ad-bday">
              {birthdays.length === 0 && <li className="muted" style={{ display: "block", padding: 8 }}>No birthdays this month.</li>}
              {birthdays.map((b) => (
                <li key={`${b.empId}-${b.date}`}>
                  <EmpDp empId={b.empId} name={b.name} color={b.color} size={36} />
                  <button type="button" className="ad-name-link" onClick={() => openEmp(b.empId)}>
                    <b>{b.name}</b>
                  </button>
                  <em>{b.label}</em>
                </li>
              ))}
            </ul>
          </article>

          <article className="ad-promo ad-enter" style={{ animationDelay: "980ms" }}>
            <div className="ad-promo-copy">
              <h3>Invest in people.<br />Build the future.</h3>
              <p>A happier workforce, a stronger tomorrow.</p>
            </div>
            <div className="ad-promo-art" aria-hidden>
              <span className="ad-promo-orb" />
              <span className="ad-promo-desk" />
              <span className="ad-promo-person" />
            </div>
          </article>
        </aside>
      </section>

      <LeaveDetailModal
        row={leaveDetail}
        onClose={() => setLeaveDetail(null)}
        canDecide={leaveDetail?.status === "pending"}
        approveLabel="HR approve"
        acting={leaveActing}
        onDecide={decideLeave}
        onOpenProfile={openEmp}
      />

      <footer className="ad-page-footer ad-enter" style={{ animationDelay: "1100ms" }}>
        <span>© 2026 Softnox Technologies. All rights reserved.</span>
        <nav>
          <a href="#privacy">Privacy</a>
          <a href="#terms">Terms</a>
          <a href="#help">Help &amp; Support</a>
        </nav>
      </footer>
    </div>
  );
}
