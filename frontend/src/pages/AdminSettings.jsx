import { useEffect, useState } from "react";
import { App as AntApp, Spin } from "antd";
import {
  BankOutlined,
  ClockCircleOutlined,
  GlobalOutlined,
  SettingOutlined,
  TeamOutlined,
  ApartmentOutlined,
} from "@ant-design/icons";
import api from "../api";
import AdminPage from "../components/AdminPage";

const FACT_META = [
  { key: "company", label: "Company", icon: <BankOutlined />, tone: "navy", hint: "Organization name" },
  { key: "timezone", label: "Timezone", icon: <GlobalOutlined />, tone: "blue", hint: "Attendance timezone" },
  { key: "cutoff", label: "Workday cutoff", icon: <ClockCircleOutlined />, tone: "amber", hint: "Daily punch cutoff" },
  { key: "employees", label: "Employees", icon: <TeamOutlined />, tone: "green", hint: "Active employees" },
  { key: "departments", label: "Departments", icon: <ApartmentOutlined />, tone: "purple", hint: "Cost centers" },
  { key: "teams", label: "Teams", icon: <TeamOutlined />, tone: "cyan", hint: "Team groups" },
];

export default function AdminSettings() {
  const { message } = AntApp.useApp();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/admin/settings");
        setSettings(data);
      } catch (err) {
        message.error(err.response?.data?.message || "Could not load settings");
      } finally {
        setLoading(false);
      }
    })().catch(() => {});
  }, [message]);

  if (loading) {
    return (
      <AdminPage title={<><SettingOutlined /> Settings</>} subtitle="Organization">
        <div className="boot"><Spin size="large" /></div>
      </AdminPage>
    );
  }

  const values = {
    company: settings?.companyName || "Softnox Technologies",
    timezone: settings?.timezone || "Asia/Karachi",
    cutoff: settings?.workdayCutoff || "08:00",
    employees: String(settings?.totalEmployees ?? 0),
    departments: String(settings?.totalDepartments ?? 0),
    teams: String(settings?.totalTeams ?? 0),
  };

  return (
    <AdminPage
      title={<><SettingOutlined /> Settings</>}
      subtitle="Softnox organization configuration (read-only)"
    >
      <div className="set-banner set-enter">
        <div className="set-banner-icon"><SettingOutlined /></div>
        <div>
          <h3>Organization overview</h3>
          <p>These values drive attendance cutoff, reports, and Softnox employee grouping. Editing will arrive in a later release.</p>
        </div>
        <span className="set-badge">Read only</span>
      </div>

      <section className="set-grid">
        {FACT_META.map((f, i) => (
          <article
            key={f.key}
            className={`set-card tone-${f.tone} set-enter`}
            style={{ animationDelay: `${60 + i * 50}ms` }}
          >
            <div className="set-card-icon">{f.icon}</div>
            <div className="set-card-copy">
              <span className="set-label">{f.label}</span>
              <strong className="set-value">{values[f.key]}</strong>
              <small className="set-hint">{f.hint}</small>
            </div>
          </article>
        ))}
      </section>

      <section className="set-detail set-enter" style={{ animationDelay: "360ms" }}>
        <header className="set-detail-head">
          <h3>Attendance rules</h3>
          <span className="muted">Applied across Softnox</span>
        </header>
        <ul className="set-rules">
          <li>
            <b>Timezone</b>
            <span>{values.timezone}</span>
          </li>
          <li>
            <b>Workday cutoff</b>
            <span>{values.cutoff} — punches after this shift to next day</span>
          </li>
          <li>
            <b>Company</b>
            <span>{values.company}</span>
          </li>
          <li>
            <b>Workforce</b>
            <span>{values.employees} employees · {values.departments} departments · {values.teams} teams</span>
          </li>
        </ul>
      </section>
    </AdminPage>
  );
}
