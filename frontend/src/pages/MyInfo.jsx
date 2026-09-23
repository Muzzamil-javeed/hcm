import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  App as AntApp,
  Avatar,
  Progress,
  Spin,
  Tag,
} from "antd";
import {
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
import { useAuth } from "../context/AuthContext";

function initials(name = "") {
  return name.split(" ").filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "?";
}

function hashColor(id) {
  const palette = ["#2563eb", "#db2777", "#0f766e", "#7c3aed", "#d97706", "#0891b2", "#16a34a"];
  let hash = 0;
  for (const ch of String(id || "")) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length];
}

function TagRow({ label, value, tone = "blue" }) {
  return (
    <div className="mi-row mi-row-tag">
      <span>{label}</span>
      <Tag className={`mi-work-tag tone-${tone}`}>{value || "—"}</Tag>
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
  });
}

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "personal", label: "Personal" },
  { key: "assets", label: "Assets" },
  { key: "leaves", label: "Leaves" },
];

export default function MyInfo() {
  const { user } = useAuth();
  const { message } = AntApp.useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: res } = await api.get("/dashboard/profile");
        setData(res);
      } catch (err) {
        message.error(err.response?.data?.message || "Could not load your info");
      } finally {
        setLoading(false);
      }
    })().catch(() => {});
  }, [message]);

  const emp = data?.employee || {};
  const years = useMemo(() => {
    if (!emp.joiningDate || !/^\d{4}-\d{2}-\d{2}/.test(emp.joiningDate)) return null;
    const join = new Date(`${emp.joiningDate.slice(0, 10)}T12:00:00`);
    if (Number.isNaN(join.getTime())) return null;
    const y = (Date.now() - join.getTime()) / (365.25 * 86400000);
    return Math.max(0, Math.floor(y));
  }, [emp.joiningDate]);

  if (loading || !data) {
    return (
      <div className="mi-boot">
        <Spin size="large" />
      </div>
    );
  }

  const balances = [
    { key: "casual", label: "Casual", value: data.balances?.casual ?? 0, color: "#2563eb", max: 6 },
    { key: "annual", label: "Annual", value: data.balances?.annual ?? 0, color: "#7c3aed", max: 8 },
    { key: "sick", label: "Sick", value: data.balances?.sick ?? 0, color: "#f59e0b", max: 6 },
  ];

  return (
    <div className="mi-page">
      <section className="mi-hero mi-enter">
        <div>
          <h1><IdcardOutlined /> My Info</h1>
          <p>Your Softnox profile, assets, and leave summary</p>
        </div>
      </section>

      <div className="mi-layout">
        <aside className="mi-side mi-enter" style={{ animationDelay: "60ms" }}>
          <div className="mi-side-hero">
            <Avatar size={88} style={{ background: hashColor(emp.empId), fontSize: 30 }}>
              {initials(emp.name || user?.name)}
            </Avatar>
            <h2>{emp.name || user?.name}</h2>
            <Tag className="mi-job">{emp.jobTitle || "Employee"}</Tag>
            {years != null && years > 0 && (
              <Tag className="mi-years">{years}+ years with Softnox</Tag>
            )}
          </div>

          <ul className="mi-quick">
            <li><IdcardOutlined /><span>Emp Code</span><b>{emp.empId}</b></li>
            <li><TeamOutlined /><span>Team</span><b>{emp.team || "—"}</b></li>
            <li><CalendarOutlined /><span>Joined</span><b>{emp.joiningDate || "—"}</b></li>
            <li><UserOutlined /><span>Reports To</span><b>{emp.reportsTo || "—"}</b></li>
          </ul>

          <div className="mi-contact">
            {emp.email ? (
              <a href={`mailto:${emp.email}`} className="mi-contact-chip">
                <MailOutlined /> {emp.email}
              </a>
            ) : null}
            {emp.mobile ? (
              <span className="mi-contact-chip">
                <PhoneOutlined /> {emp.mobile}
              </span>
            ) : null}
          </div>
        </aside>

        <main className="mi-main">
          <div className="mi-tabs mi-enter" style={{ animationDelay: "100ms" }}>
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                className={tab === t.key ? "active" : ""}
                onClick={() => setTab(t.key)}
              >
                {t.label}
                {t.key === "assets" ? <em>{(data.assets || []).length}</em> : null}
              </button>
            ))}
          </div>

          {tab === "overview" && (
            <div className="mi-stack mi-enter" key="overview">
              <section className="mi-card">
                <header className="mi-card-head">
                  <h3>Today&apos;s snapshot</h3>
                  <span className="muted">{data.today?.displayDate || data.today?.date}</span>
                </header>
                <div className="mi-stat-grid">
                  <article>
                    <span>Status</span>
                    <strong>{data.today?.status || "—"}</strong>
                  </article>
                  <article>
                    <span>Check In</span>
                    <strong>{data.today?.checkInLabel || "—"}</strong>
                  </article>
                  <article>
                    <span>Check Out</span>
                    <strong>{data.today?.checkOutLabel || "—"}</strong>
                  </article>
                  <article>
                    <span>Hours</span>
                    <strong>{data.today?.hours != null ? Number(data.today.hours).toFixed(2) : "—"}</strong>
                  </article>
                </div>
              </section>

              <section className="mi-card">
                <header className="mi-card-head">
                  <h3>Work details</h3>
                </header>
                <div className="mi-info-grid mi-work-tags">
                  <TagRow label="Department" value={emp.department} tone="blue" />
                  <TagRow label="Designation" value={emp.jobTitle} tone="navy" />
                  <TagRow label="Role" value={emp.role} tone="amber" />
                  <TagRow label="Shift" value={emp.slot || emp.shift} tone="teal" />
                  <TagRow label="Team" value={emp.team} tone="green" />
                  <TagRow label="Reports To" value={emp.reportsTo} tone="pink" />
                </div>
              </section>

              <section className="mi-card">
                <header className="mi-card-head">
                  <h3>Assigned assets</h3>
                  <Link to="#" className="mi-link" onClick={(e) => { e.preventDefault(); setTab("assets"); }}>
                    View all →
                  </Link>
                </header>
                <div className="mi-asset-preview">
                  {(data.assets || []).slice(0, 3).map((a) => (
                    <article key={a.assetId || a._id} className="mi-asset-mini">
                      <span className="mi-asset-ico">{assetIcon(a.type)}</span>
                      <div>
                        <b>{a.name}</b>
                        <small>{a.categoryCode || a.category}</small>
                      </div>
                    </article>
                  ))}
                  {!(data.assets || []).length && <p className="muted">No assets assigned yet.</p>}
                </div>
              </section>
            </div>
          )}

          {tab === "personal" && (
            <div className="mi-stack mi-enter" key="personal">
              <section className="mi-card">
                <header className="mi-card-head"><h3>Basic information</h3></header>
                <div className="mi-info-grid">
                  <TagRow label="Phone" value={emp.mobile} tone="teal" />
                  <TagRow label="Email" value={emp.email} tone="blue" />
                  <TagRow label="Gender" value={emp.gender} tone="navy" />
                  <TagRow label="Date of Birth" value={emp.dateOfBirth} tone="amber" />
                  <TagRow label="Joining Date" value={emp.joiningDate} tone="green" />
                  <TagRow label="Employee ID" value={emp.empId} tone="pink" />
                </div>
              </section>
              <section className="mi-card">
                <header className="mi-card-head"><h3>Personal information</h3></header>
                <div className="mi-info-grid">
                  <TagRow label="CNIC" value={emp.cnicNo} tone="navy" />
                  <TagRow label="Nationality" value="Pakistani" tone="green" />
                  <TagRow label="Religion" value={emp.religion} tone="amber" />
                  <TagRow label="Marital Status" value={emp.maritalStatus} tone="pink" />
                  <TagRow label="Full Department" value={emp.departmentFull} tone="blue" />
                  <TagRow label="Serial No" value={emp.serialNo} tone="teal" />
                </div>
              </section>
              <section className="mi-card">
                <header className="mi-card-head"><h3>Emergency contact</h3></header>
                <div className="mi-info-grid">
                  <TagRow
                    label="Primary"
                    value={emp.reportsTo && emp.reportsTo !== "-" ? emp.reportsTo : "HR Softnox"}
                    tone="pink"
                  />
                  <TagRow label="Phone" value={emp.mobile} tone="teal" />
                </div>
              </section>
            </div>
          )}

          {tab === "assets" && (
            <div className="mi-stack mi-enter" key="assets">
              <section className="mi-card">
                <header className="mi-card-head">
                  <h3>My company assets</h3>
                  <span className="muted">{(data.assets || []).length} items</span>
                </header>
                <ul className="mi-asset-list">
                  {(data.assets || []).map((a, i) => (
                    <li key={a.assetId || a._id} className="mi-enter" style={{ animationDelay: `${i * 40}ms` }}>
                      <span className="mi-asset-ico lg">{assetIcon(a.type)}</span>
                      <div className="mi-asset-copy">
                        <b>{a.name}</b>
                        <small>{a.assetId} · {a.categoryCode || a.category}</small>
                      </div>
                      <div className="mi-asset-meta">
                        <Tag className="mi-asset-tag">Assigned</Tag>
                        <em>{formatAssigned(a.assignedAt)}</em>
                        <small>by {a.assignedBy || "Softnox IT"}</small>
                      </div>
                    </li>
                  ))}
                  {!(data.assets || []).length && (
                    <li className="muted" style={{ display: "block", padding: 16 }}>No assets assigned yet.</li>
                  )}
                </ul>
              </section>
            </div>
          )}

          {tab === "leaves" && (
            <div className="mi-stack mi-enter" key="leaves">
              <section className="mi-card">
                <header className="mi-card-head">
                  <h3>Leave balances</h3>
                  <Link to="/leave" className="mi-link">Apply leave →</Link>
                </header>
                <div className="mi-bal-grid">
                  {balances.map((b) => (
                    <article key={b.key} className="mi-bal">
                      <span>{b.label}</span>
                      <strong>{Number(b.value).toFixed(1)}</strong>
                      <Progress
                        percent={Math.min(100, (Number(b.value) / b.max) * 100)}
                        showInfo={false}
                        strokeColor={b.color}
                        trailColor="#eef2f7"
                        size="small"
                      />
                    </article>
                  ))}
                </div>
                <div className="mi-leave-counts">
                  <span>Pending <b>{data.leaveCounts?.pending || 0}</b></span>
                  <span>Approved <b>{data.leaveCounts?.approved || 0}</b></span>
                  <span>Rejected <b>{data.leaveCounts?.rejected || 0}</b></span>
                </div>
              </section>

              <section className="mi-card">
                <header className="mi-card-head">
                  <h3>Recent leave requests</h3>
                  <ClockCircleOutlined className="muted" />
                </header>
                <ul className="mi-leave-list">
                  {(data.recentLeaves || []).map((r) => (
                    <li key={r._id}>
                      <div>
                        <b>{r.type}</b>
                        <small>{r.fromDate} → {r.toDate} · {r.days} day(s)</small>
                      </div>
                      <Tag className={`mi-leave-tag ${r.status}`}>{r.status}</Tag>
                    </li>
                  ))}
                  {!(data.recentLeaves || []).length && (
                    <li className="muted" style={{ display: "block", padding: 12 }}>No leave requests yet.</li>
                  )}
                </ul>
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
