import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  App as AntApp,
  Avatar,
  Input,
  Progress,
  Spin,
  Table,
  Tag,
} from "antd";
import {
  CrownOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import api from "../api";
import AdminPage from "../components/AdminPage";

const ROLE_META = {
  Head: { tone: "blue", icon: <CrownOutlined />, color: "#2563eb", access: ["Full admin console", "Approve leaves", "View payroll", "Manage departments"] },
  Manager: { tone: "amber", icon: <SafetyCertificateOutlined />, color: "#f59e0b", access: ["Team attendance", "Approve team leaves", "View reports", "Department overview"] },
  Member: { tone: "green", icon: <UserOutlined />, color: "#22c55e", access: ["Own attendance", "Request leave", "View profile", "Punch history"] },
};

function initials(name = "") {
  return name.split(" ").filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "?";
}

function hashColor(id) {
  const palette = ["#2563eb", "#db2777", "#0f766e", "#7c3aed", "#d97706", "#0891b2", "#16a34a", "#ea580c"];
  let hash = 0;
  for (const ch of String(id || "")) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length];
}

export default function AdminRoles() {
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const [roles, setRoles] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState("Head");
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/admin/roles");
        setRoles(data.roles || []);
        setTotal(data.total || 0);
        if (data.roles?.[0]?.name) setActive(data.roles[0].name);
      } catch (err) {
        message.error(err.response?.data?.message || "Could not load roles");
      } finally {
        setLoading(false);
      }
    })().catch(() => {});
  }, [message]);

  const current = roles.find((r) => r.name === active) || roles[0];
  const employees = current?.employees || [];
  const meta = ROLE_META[current?.name] || ROLE_META.Member;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return employees;
    return employees.filter((e) =>
      [e.name, e.empId, e.department, e.team, e.jobTitle].join(" ").toLowerCase().includes(needle)
    );
  }, [employees, q]);

  const pie = useMemo(
    () =>
      roles.map((r) => ({
        name: r.name,
        value: r.count,
        color: ROLE_META[r.name]?.color || "#64748b",
      })),
    [roles]
  );

  function openEmp(empId) {
    if (!empId) return;
    navigate(`/admin/employees/${empId}`);
  }

  if (loading && !roles.length) {
    return (
      <AdminPage title={<><SafetyCertificateOutlined /> Roles & Permissions</>} subtitle="Loading…">
        <div className="boot"><Spin size="large" /></div>
      </AdminPage>
    );
  }

  return (
    <AdminPage
      title={<><SafetyCertificateOutlined /> Roles & Permissions</>}
      subtitle="Employees grouped by Head / Manager / Member"
    >
      <section className="role-top">
        <div className="role-cards">
          {roles.map((r, i) => {
            const m = ROLE_META[r.name] || ROLE_META.Member;
            const pct = total ? Math.round((r.count / total) * 100) : 0;
            return (
              <button
                key={r.name}
                type="button"
                className={`role-card tone-${m.tone} role-enter${active === r.name ? " is-active" : ""}`}
                style={{ animationDelay: `${40 + i * 60}ms` }}
                onClick={() => setActive(r.name)}
              >
                <div className="role-card-top">
                  <span className="role-card-icon">{m.icon}</span>
                  <Tag className={`role-pill tone-${m.tone}`}>{r.name}</Tag>
                </div>
                <strong>{r.count}</strong>
                <small>{pct}% of employees</small>
                <Progress
                  percent={pct}
                  showInfo={false}
                  size="small"
                  strokeColor={m.color}
                  trailColor="#eef2f7"
                />
              </button>
            );
          })}
        </div>

        <article className="role-side role-enter" style={{ animationDelay: "180ms" }}>
          <header className="role-side-head">
            <h3>Role mix</h3>
          </header>
          <div className="role-donut-wrap">
            <div className="role-donut">
              <ResponsiveContainer width={150} height={150}>
                <PieChart>
                  <Pie data={pie} dataKey="value" nameKey="name" innerRadius={46} outerRadius={66} paddingAngle={2} stroke="none">
                    {pie.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="role-donut-center">
                <b>{total}</b>
                <span>Total</span>
              </div>
            </div>
            <ul className="role-legend">
              {pie.map((d) => (
                <li key={d.name}>
                  <i style={{ background: d.color }} />
                  <span>{d.name}</span>
                  <em>{d.value}</em>
                </li>
              ))}
            </ul>
          </div>
        </article>
      </section>

      <section className="role-main role-enter" style={{ animationDelay: "240ms" }}>
        <aside className={`role-access tone-${meta.tone}`}>
          <div className="role-access-icon">{meta.icon}</div>
          <h3>{current?.name || "Role"} access</h3>
          <p>Typical Softnox permissions for this role.</p>
          <ul>
            {(meta.access || []).map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </aside>

        <div className="role-table-wrap">
          <div className="role-table-toolbar">
            <div>
              <h3>{current?.name || "Role"} · {employees.length} people</h3>
              <p className="muted">Click a row or avatar to open employee profile</p>
            </div>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Search in this role…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="role-search"
            />
          </div>

          <Table
            className="emp-table soft-card role-table"
            rowKey="empId"
            loading={loading}
            dataSource={filtered}
            pagination={{ pageSize: 12, showTotal: (t) => `${t} people` }}
            onRow={(r) => ({
              onClick: () => openEmp(r.empId),
              className: "role-row-click",
            })}
            columns={[
              {
                title: "Employee",
                dataIndex: "name",
                render: (n, r) => (
                  <button
                    type="button"
                    className="role-emp-cell"
                    onClick={(e) => { e.stopPropagation(); openEmp(r.empId); }}
                  >
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
            ]}
          />
        </div>
      </section>
    </AdminPage>
  );
}
