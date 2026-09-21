import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  App as AntApp,
  Avatar,
  Input,
  Select,
  Spin,
  Table,
  Tag,
} from "antd";
import {
  BankOutlined,
  DollarOutlined,
  SearchOutlined,
  TeamOutlined,
  UserOutlined,
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

function initials(name = "") {
  return name.split(" ").filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "?";
}

function hashColor(id) {
  const palette = ["#2563eb", "#db2777", "#0f766e", "#7c3aed", "#d97706", "#0891b2", "#16a34a", "#ea580c"];
  let hash = 0;
  for (const ch of String(id || "")) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length];
}

function pkr(n) {
  return `PKR ${Number(n || 0).toLocaleString("en-PK")}`;
}

const ROLE_COLORS = {
  Head: "#2563eb",
  Manager: "#f59e0b",
  Member: "#22c55e",
};

export default function AdminPayroll() {
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const [rows, setRows] = useState([]);
  const [note, setNote] = useState("");
  const [totalEstimate, setTotalEstimate] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [department, setDepartment] = useState("all");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/admin/payroll");
        setRows(data.payroll || []);
        setNote(data.note || "");
        setTotalEstimate(data.totalEstimate || 0);
      } catch (err) {
        message.error(err.response?.data?.message || "Could not load payroll");
      } finally {
        setLoading(false);
      }
    })().catch(() => {});
  }, [message]);

  const departments = useMemo(
    () => [...new Set(rows.map((r) => r.department).filter(Boolean))].sort(),
    [rows]
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (department !== "all" && r.department !== department) return false;
      if (!needle) return true;
      return [r.name, r.empId, r.jobTitle, r.department, r.team, r.role]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [rows, q, department]);

  const byRole = useMemo(() => {
    const map = {};
    for (const r of rows) {
      const key = r.role || "Member";
      if (!map[key]) map[key] = { name: key, count: 0, gross: 0, color: ROLE_COLORS[key] || "#64748b" };
      map[key].count += 1;
      map[key].gross += r.monthlyGross || 0;
    }
    return Object.values(map).sort((a, b) => b.gross - a.gross);
  }, [rows]);

  const byDept = useMemo(() => {
    const map = {};
    for (const r of rows) {
      const key = r.department || "Other";
      if (!map[key]) map[key] = { name: key, count: 0, gross: 0 };
      map[key].count += 1;
      map[key].gross += r.monthlyGross || 0;
    }
    return Object.values(map).sort((a, b) => b.gross - a.gross).slice(0, 8);
  }, [rows]);

  const avgGross = rows.length ? Math.round(totalEstimate / rows.length) : 0;

  function openEmp(empId) {
    if (!empId) return;
    navigate(`/admin/employees/${empId}`);
  }

  if (loading && !rows.length) {
    return (
      <AdminPage title={<><DollarOutlined /> Payroll</>} subtitle="Loading…">
        <div className="boot"><Spin size="large" /></div>
      </AdminPage>
    );
  }

  return (
    <AdminPage
      title={<><DollarOutlined /> Payroll</>}
      subtitle={`${rows.length} employees · estimated monthly gross ${pkr(totalEstimate)}`}
    >
      {note ? (
        <div className="pay-note">
          <i />
          <span>{note}</span>
        </div>
      ) : null}

      <section className="pay-kpis">
        <article className="pay-kpi tone-navy">
          <div className="pay-kpi-icon"><TeamOutlined /></div>
          <div>
            <span>Total employees</span>
            <strong>{rows.length}</strong>
            <small>active employees</small>
          </div>
        </article>
        <article className="pay-kpi tone-green">
          <div className="pay-kpi-icon"><DollarOutlined /></div>
          <div>
            <span>Est. monthly payroll</span>
            <strong>{pkr(totalEstimate)}</strong>
            <small>role-based estimate</small>
          </div>
        </article>
        <article className="pay-kpi tone-blue">
          <div className="pay-kpi-icon"><UserOutlined /></div>
          <div>
            <span>Avg. per employee</span>
            <strong>{pkr(avgGross)}</strong>
            <small>monthly gross</small>
          </div>
        </article>
        <article className="pay-kpi tone-amber">
          <div className="pay-kpi-icon"><BankOutlined /></div>
          <div>
            <span>Departments</span>
            <strong>{departments.length}</strong>
            <small>cost centers</small>
          </div>
        </article>
      </section>

      <section className="pay-viz-grid">
        <article className="pay-panel">
          <header className="pay-panel-head">
            <h3>Cost by department</h3>
          </header>
          <div className="pay-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byDept} layout="vertical" margin={{ top: 4, right: 48, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="payDeptBar" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#1e3a5f" />
                    <stop offset="100%" stopColor="#60a5fa" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={120} tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v, _n, p) => [pkr(v), `Est. gross · ${p.payload.count} emp`]}
                  contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }}
                />
                <Bar dataKey="gross" fill="url(#payDeptBar)" radius={[0, 8, 8, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="pay-panel">
          <header className="pay-panel-head">
            <h3>Payroll by role</h3>
          </header>
          <div className="pay-role-body">
            <div className="pay-donut">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={byRole} dataKey="gross" nameKey="name" innerRadius={48} outerRadius={70} paddingAngle={2} stroke="none">
                    {byRole.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => pkr(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pay-donut-center">
                <b>{pkr(totalEstimate).replace("PKR ", "")}</b>
                <span>PKR / mo</span>
              </div>
            </div>
            <ul className="pay-role-legend">
              {byRole.map((d) => (
                <li key={d.name}>
                  <i style={{ background: d.color }} />
                  <div>
                    <b>{d.name}</b>
                    <small>{d.count} employees</small>
                  </div>
                  <em>{pkr(d.gross)}</em>
                </li>
              ))}
            </ul>
          </div>
        </article>
      </section>

      <section className="pay-table-wrap">
        <div className="pay-filters">
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Search employee, role, department…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pay-search"
          />
          <Select
            value={department}
            onChange={setDepartment}
            className="pay-dept-select"
            options={[
              { value: "all", label: "All departments" },
              ...departments.map((d) => ({ value: d, label: d })),
            ]}
          />
        </div>

        <Table
          className="emp-table soft-card pay-table"
          rowKey="empId"
          loading={loading}
          dataSource={filtered}
          pagination={{ pageSize: 15, showTotal: (t) => `${t} employees` }}
          onRow={(r) => ({
            onClick: () => openEmp(r.empId),
            className: "pay-row-click",
          })}
          columns={[
            {
              title: "Employee",
              dataIndex: "name",
              render: (n, r) => (
                <button type="button" className="pay-emp-cell" onClick={(e) => { e.stopPropagation(); openEmp(r.empId); }}>
                  <Avatar size={40} style={{ background: hashColor(r.empId), flexShrink: 0 }}>
                    {initials(n)}
                  </Avatar>
                  <span>
                    <b>{n}</b>
                    <small>Emp {r.empId}</small>
                  </span>
                </button>
              ),
            },
            { title: "Department", dataIndex: "department" },
            { title: "Team", dataIndex: "team" },
            { title: "Job title", dataIndex: "jobTitle", ellipsis: true },
            {
              title: "Role",
              dataIndex: "role",
              render: (v) => (
                <Tag className={`pay-role-tag ${(v || "").toLowerCase()}`}>{v}</Tag>
              ),
            },
            {
              title: "Est. monthly gross",
              dataIndex: "monthlyGross",
              align: "right",
              render: (v) => <strong className="pay-amount">{pkr(v)}</strong>,
            },
          ]}
        />
      </section>
    </AdminPage>
  );
}
