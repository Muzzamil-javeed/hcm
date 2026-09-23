import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  App as AntApp,
  Avatar,
  Collapse,
  Spin,
  Tabs,
  Tag,
} from "antd";
import {
  ArrowLeftOutlined,
  AudioOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  DesktopOutlined,
  IdcardOutlined,
  LaptopOutlined,
  MailOutlined,
  MobileOutlined,
  PhoneOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import api from "../api";

function initials(name = "") {
  return name.split(" ").filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "?";
}

function hashColor(id) {
  const palette = ["#2563eb", "#db2777", "#0f766e", "#7c3aed", "#d97706", "#0891b2", "#16a34a"];
  let hash = 0;
  for (const ch of String(id || "")) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length];
}

function InfoRow({ label, value }) {
  return (
    <div className="emp-profile-row">
      <span>{label}</span>
      <b>{value || "—"}</b>
    </div>
  );
}

function assetIcon(type) {
  switch (type) {
    case "laptop":
    case "desktop":
      return <LaptopOutlined />;
    case "monitor":
      return <DesktopOutlined />;
    case "phone":
      return <MobileOutlined />;
    case "headset":
      return <AudioOutlined />;
    case "idcard":
    case "access":
      return <IdcardOutlined />;
    default:
      return <DesktopOutlined />;
  }
}

function formatAssigned(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AdminEmployeeProfile() {
  const { empId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const base = user?.isHr ? "/hr" : "/admin";
  const { message } = AntApp.useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("assets");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: res } = await api.get(`/admin/employees/${empId}`);
        setData(res);
      } catch (err) {
        message.error(err.response?.data?.message || "Employee not found");
        setData(null);
      } finally {
        setLoading(false);
      }
    })().catch(() => {});
  }, [empId, message]);

  const emp = data?.employee;
  const assets = data?.assets || [];

  const years = useMemo(() => {
    if (!emp?.joiningDate || !/^\d{4}-\d{2}/.test(emp.joiningDate)) return null;
    const y = new Date().getFullYear() - Number(emp.joiningDate.slice(0, 4));
    return y >= 0 ? y : null;
  }, [emp]);

  if (loading) {
    return <div className="boot" style={{ minHeight: 320 }}><Spin size="large" /></div>;
  }

  if (!emp) {
    return (
      <div className="emp-profile-page">
        <button type="button" className="ad-link" onClick={() => navigate(`${base}/employees`)}>
          ← Back to Employees
        </button>
        <p className="muted">Employee not found.</p>
      </div>
    );
  }

  return (
    <div className="emp-profile-page">
      <div className="emp-profile-crumb">
        <button type="button" className="crumb-back" onClick={() => navigate(`${base}/employees`)}>
          <ArrowLeftOutlined /> Employees
        </button>
        <span>/</span>
        <b>{emp.name}</b>
      </div>

      <div className="emp-profile-grid">
        <aside className="emp-profile-side ad-enter">
          <div className="emp-profile-hero">
            <Avatar size={96} style={{ background: hashColor(emp.empId), fontSize: 32 }}>
              {initials(emp.name)}
            </Avatar>
            <h2>{emp.name}</h2>
            <div className="emp-viz-tags" style={{ justifyContent: "center" }}>
              <Tag className="emp-tag job">{emp.jobTitle || "Employee"}</Tag>
              <Tag className="emp-tag id">Emp {emp.empId}</Tag>
            </div>
            {years != null && (
              <Tag className="emp-tag dept" style={{ marginTop: 8 }}>
                {years}+ years with Softnox
              </Tag>
            )}
          </div>

          <div className="emp-profile-quick">
            <div><IdcardOutlined /> <span>Emp Code</span> <b>{emp.empId}</b></div>
            <div><TeamOutlined /> <span>Team</span> <b>{emp.team || "—"}</b></div>
            <div><CalendarOutlined /> <span>Joined</span> <b>{emp.joiningDate || "—"}</b></div>
            <div><UserOutlined /> <span>Reports To</span> <b>{emp.reportsTo || "—"}</b></div>
          </div>

          <div className="emp-profile-actions">
            <Link className="emp-btn primary" to={`${base}/attendance/${emp.empId}`}>
              <ClockCircleOutlined /> View Attendance
            </Link>
            <a className="emp-btn ghost" href={emp.email ? `mailto:${emp.email}` : undefined}>
              <MailOutlined /> Message
            </a>
          </div>

          <section className="emp-profile-block">
            <header>
              <h4>Basic information</h4>
            </header>
            <InfoRow label="Phone" value={(emp.mobiles || []).map((row) => row.value).filter(Boolean).join(", ") || emp.mobile} />
            <InfoRow label="Email" value={(emp.emails || []).map((row) => row.value).filter(Boolean).join(", ") || emp.email} />
            <InfoRow label="Gender" value={emp.gender} />
            <InfoRow label="Birthday" value={emp.dateOfBirth} />
            <InfoRow label="Department" value={emp.department} />
            <InfoRow label="Designation" value={emp.jobTitle} />
            <InfoRow label="Shift / Slot" value={emp.slot || emp.shift} />
          </section>

          <section className="emp-profile-block">
            <header>
              <h4>Personal information</h4>
            </header>
            <InfoRow label="CNIC" value={emp.cnicNo} />
            <InfoRow label="Nationality" value="Pakistani" />
            <InfoRow label="Religion" value={emp.religion} />
            <InfoRow label="Marital Status" value={emp.maritalStatus} />
            <InfoRow label="Full Department" value={emp.departmentFull} />
            <InfoRow label="Role" value={emp.role} />
            {(emp.documentItems || []).map((doc) => (
              <InfoRow key={doc.name} label={doc.name} value={doc.received ? "Received" : "Not received"} />
            ))}
            {(emp.extraFields || []).map((field) => (
              <InfoRow key={field.label} label={field.label} value={field.value} />
            ))}
          </section>

          <section className="emp-profile-block">
            <header>
              <h4>Emergency contact</h4>
            </header>
            <InfoRow label="Primary" value={emp.reportsTo && emp.reportsTo !== "-" ? emp.reportsTo : "HR Softnox"} />
            <InfoRow label="Phone" value={emp.mobile || "—"} />
          </section>
        </aside>

        <main className="emp-profile-main">
          <section className="emp-profile-panel ad-enter" style={{ animationDelay: "60ms" }}>
            <h3>Today&apos;s snapshot</h3>
            <div className="att-modal-stats">
              <div>
                <span>Status</span>
                <strong>{data.today?.status || "—"}</strong>
              </div>
              <div>
                <span>Check In</span>
                <strong>{data.today?.checkInLabel || "—"}</strong>
              </div>
              <div>
                <span>Check Out</span>
                <strong>{data.today?.checkOutLabel || "—"}</strong>
              </div>
              <div>
                <span>Hours</span>
                <strong>{data.today?.hours != null ? Number(data.today.hours).toFixed(2) : "—"}</strong>
              </div>
            </div>
          </section>

          <section className="emp-profile-panel ad-enter" style={{ animationDelay: "120ms" }}>
            <h3>Leave balances</h3>
            <div className="emp-balance-grid">
              <article>
                <span>Casual</span>
                <strong>{data.balances?.casual ?? "—"}</strong>
              </article>
              <article>
                <span>Annual</span>
                <strong>{data.balances?.annual ?? "—"}</strong>
              </article>
              <article>
                <span>Sick</span>
                <strong>{data.balances?.sick ?? "—"}</strong>
              </article>
            </div>
          </section>

          <section className="emp-profile-panel emp-tabs-panel ad-enter" style={{ animationDelay: "180ms" }}>
            <Tabs
              activeKey={tab}
              onChange={setTab}
              className="emp-profile-tabs"
              items={[
                {
                  key: "assets",
                  label: `Assets (${assets.length})`,
                  children: assets.length ? (
                    <ul className="emp-asset-list">
                      {assets.map((a) => (
                        <li key={a._id || a.assetId}>
                          <div className={`emp-asset-thumb type-${a.type || "other"}`}>
                            {assetIcon(a.type)}
                          </div>
                          <div className="emp-asset-body">
                            <b>{a.name}</b>
                            <small>
                              {a.categoryCode || a.category || "AST"} · Assigned on {formatAssigned(a.assignedAt)}
                            </small>
                          </div>
                          <div className="emp-asset-by">
                            <span>Assigned by</span>
                            <div>
                              <Avatar size={28} style={{ background: hashColor(a.assignedBy) }}>
                                {initials(a.assignedBy || "IT")}
                              </Avatar>
                              <em>{a.assignedBy || "Softnox IT"}</em>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted" style={{ margin: 0 }}>No assets assigned yet.</p>
                  ),
                },
                {
                  key: "overview",
                  label: "Overview",
                  children: (
                    <Collapse
                      ghost
                      defaultActiveKey={["about"]}
                      items={[
                        {
                          key: "about",
                          label: "About employee",
                          children: (
                            <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>
                              {emp.name} works as {emp.jobTitle || "Employee"} in {emp.department || "Softnox"}
                              {emp.team ? ` (${emp.team} team)` : ""}.
                              {emp.reportsTo && emp.reportsTo !== "-" ? ` Reports to ${emp.reportsTo}.` : ""}
                              {emp.joiningDate ? ` Joined on ${emp.joiningDate}.` : ""}
                            </p>
                          ),
                        },
                        {
                          key: "details",
                          label: "Employee details",
                          children: (
                            <>
                              <InfoRow label="Serial No" value={emp.serialNo} />
                              <InfoRow label="Source" value={emp.source} />
                              <InfoRow label="Created" value={emp.createdAt ? new Date(emp.createdAt).toLocaleString() : "—"} />
                              <InfoRow label="Updated" value={emp.updatedAt ? new Date(emp.updatedAt).toLocaleString() : "—"} />
                            </>
                          ),
                        },
                        {
                          key: "leaves",
                          label: "Recent leave requests",
                          children: (data.recentLeaves || []).length ? (
                            <ul className="emp-leave-list">
                              {data.recentLeaves.map((l) => (
                                <li key={l._id}>
                                  <div>
                                    <b>{l.type}</b>
                                    <small>{l.fromDate} → {l.toDate} · {l.days} day(s)</small>
                                  </div>
                                  <Tag color={l.status === "approved" ? "success" : l.status === "rejected" ? "error" : "warning"}>
                                    {l.status}
                                  </Tag>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="muted" style={{ margin: 0 }}>No leave requests yet.</p>
                          ),
                        },
                      ]}
                    />
                  ),
                },
              ]}
            />
          </section>
        </main>
      </div>
    </div>
  );
}
