import { useEffect, useMemo, useState } from "react";
import { App as AntApp, Spin } from "antd";
import {
  BarChartOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  TeamOutlined,
  UserAddOutlined,
} from "@ant-design/icons";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import api from "../api";
import AdminPage from "../components/AdminPage";

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      <b>{label}</b>
      <div>{payload[0].value}{payload[0].unit || ""}</div>
    </div>
  );
}

export default function AdminReports() {
  const { message } = AntApp.useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: res } = await api.get("/admin/reports");
        setData(res);
      } catch (err) {
        message.error(err.response?.data?.message || "Could not load reports");
      } finally {
        setLoading(false);
      }
    })().catch(() => {});
  }, [message]);

  const att = data?.attendance || {};
  const byDept = useMemo(() => (data?.byDepartment || []).slice(0, 10), [data]);
  const byRole = data?.byRole || [];
  const byTeam = useMemo(() => (data?.byTeam || []).slice(0, 8), [data]);

  const attMix = useMemo(() => {
    const present = att.present || 0;
    const late = att.late || 0;
    const absent = att.absent || 0;
    const onTime = Math.max(0, present - late);
    return [
      { name: "On time", value: onTime, color: "#22c55e" },
      { name: "Late", value: late, color: "#f59e0b" },
      { name: "Absent", value: absent, color: "#ef4444" },
    ].filter((d) => d.value > 0);
  }, [att]);

  const presentPct = data?.totalEmployees
    ? Math.round(((att.present || 0) / data.totalEmployees) * 1000) / 10
    : 0;

  if (loading) {
    return (
      <AdminPage title={<><BarChartOutlined /> Reports & Analytics</>} subtitle="Loading…">
        <div className="boot"><Spin size="large" /></div>
      </AdminPage>
    );
  }

  return (
    <AdminPage
      title={<><BarChartOutlined /> Reports & Analytics</>}
      subtitle={`Live Softnox snapshot for ${data?.date || "today"}`}
    >
      <section className="rpt-kpis">
        <article className="rpt-kpi tone-navy">
          <div className="rpt-kpi-icon"><TeamOutlined /></div>
          <div>
            <span>Total employees</span>
            <strong>{data?.totalEmployees || 0}</strong>
            <small>active employees</small>
          </div>
        </article>
        <article className="rpt-kpi tone-green">
          <div className="rpt-kpi-icon"><CheckCircleOutlined /></div>
          <div>
            <span>Present today</span>
            <strong>{att.present || 0}</strong>
            <small>{att.late || 0} late · {presentPct}%</small>
          </div>
        </article>
        <article className="rpt-kpi tone-red">
          <div className="rpt-kpi-icon"><CloseCircleOutlined /></div>
          <div>
            <span>Absent today</span>
            <strong>{att.absent || 0}</strong>
            <small>no punch</small>
          </div>
        </article>
        <article className="rpt-kpi tone-amber">
          <div className="rpt-kpi-icon"><CalendarOutlined /></div>
          <div>
            <span>Leave pending</span>
            <strong>{data?.leavePending || 0}</strong>
            <small>awaiting approval</small>
          </div>
        </article>
        <article className="rpt-kpi tone-cyan">
          <div className="rpt-kpi-icon"><UserAddOutlined /></div>
          <div>
            <span>New hires</span>
            <strong>{data?.newHiresThisMonth || 0}</strong>
            <small>this month</small>
          </div>
        </article>
      </section>

      <section className="rpt-grid">
        <article className="rpt-panel rpt-span-2">
          <header className="rpt-panel-head">
            <h3>Headcount by department</h3>
            <span className="muted">Top {byDept.length}</span>
          </header>
          <div className="rpt-chart tall">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byDept} margin={{ top: 8, right: 12, left: -8, bottom: 48 }}>
                <defs>
                  <linearGradient id="rptDeptBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" />
                    <stop offset="100%" stopColor="#1e3a5f" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} interval={0} angle={-28} textAnchor="end" height={70} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(37,99,235,0.06)" }} />
                <Bar dataKey="count" fill="url(#rptDeptBar)" radius={[8, 8, 0, 0]} barSize={28} name="Employees" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="rpt-panel">
          <header className="rpt-panel-head">
            <h3>Workforce by role</h3>
          </header>
          <div className="rpt-donut-wrap">
            <div className="rpt-donut">
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie data={byRole} dataKey="count" nameKey="name" innerRadius={54} outerRadius={78} paddingAngle={2} stroke="none">
                    {byRole.map((r) => (
                      <Cell key={r.name} fill={r.color || "#2563eb"} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="rpt-donut-center">
                <b>{data?.totalEmployees || 0}</b>
                <span>Employees</span>
              </div>
            </div>
            <ul className="rpt-legend">
              {byRole.map((r) => {
                const pct = data?.totalEmployees ? Math.round((r.count / data.totalEmployees) * 100) : 0;
                return (
                  <li key={r.name}>
                    <i style={{ background: r.color || "#2563eb" }} />
                    <span>{r.name}</span>
                    <em>{r.count} · {pct}%</em>
                  </li>
                );
              })}
            </ul>
          </div>
        </article>

        <article className="rpt-panel">
          <header className="rpt-panel-head">
            <h3>Attendance mix (today)</h3>
          </header>
          <div className="rpt-donut-wrap">
            <div className="rpt-donut">
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie data={attMix} dataKey="value" nameKey="name" innerRadius={54} outerRadius={78} paddingAngle={2} stroke="none">
                    {attMix.map((r) => (
                      <Cell key={r.name} fill={r.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="rpt-donut-center">
                <b>{presentPct}%</b>
                <span>Present</span>
              </div>
            </div>
            <ul className="rpt-legend">
              {attMix.map((r) => (
                <li key={r.name}>
                  <i style={{ background: r.color }} />
                  <span>{r.name}</span>
                  <em>{r.value}</em>
                </li>
              ))}
              {!attMix.length && <li className="muted">No attendance data</li>}
            </ul>
          </div>
        </article>

        <article className="rpt-panel rpt-span-2">
          <header className="rpt-panel-head">
            <h3>Headcount by team</h3>
          </header>
          <div className="rpt-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byTeam} layout="vertical" margin={{ top: 4, right: 36, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="rptTeamBar" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#0f766e" />
                    <stop offset="100%" stopColor="#5eead4" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={110} tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(15,118,110,0.06)" }} />
                <Bar dataKey="count" fill="url(#rptTeamBar)" radius={[0, 8, 8, 0]} barSize={12} name="Employees" label={{ position: "right", fill: "#64748b", fontSize: 11 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>
    </AdminPage>
  );
}
