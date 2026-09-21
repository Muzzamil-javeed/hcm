import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  App as AntApp,
  Avatar,
  Button,
  Input,
  Segmented,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from "antd";
import {
  AppstoreOutlined,
  MailOutlined,
  PhoneOutlined,
  SearchOutlined,
  TeamOutlined,
  UnorderedListOutlined,
  UserAddOutlined,
} from "@ant-design/icons";
import api from "../api";
import AdminPage from "../components/AdminPage";

function initials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";
}

function hashColor(id) {
  const palette = ["#2563eb", "#db2777", "#0f766e", "#7c3aed", "#d97706", "#0891b2", "#16a34a", "#ea580c"];
  let hash = 0;
  for (const ch of String(id || "")) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length];
}

function EmpCard({ emp, onOpen }) {
  return (
    <article className="emp-viz-card clickable" onClick={() => onOpen(emp)} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onOpen(emp); }}>
      <div className="emp-viz-card-top">
        <Avatar size={52} style={{ background: hashColor(emp.empId) }}>
          {initials(emp.name)}
        </Avatar>
        <Tag color={emp.role === "Head" ? "blue" : emp.role === "Manager" ? "gold" : "default"}>
          {emp.role || "Member"}
        </Tag>
      </div>
      <h3>{emp.name}</h3>
      <div className="emp-viz-tags">
        <Tag className="emp-tag id">Emp {emp.empId}</Tag>
        <Tag className="emp-tag job" title={emp.jobTitle}>{emp.jobTitle || "Employee"}</Tag>
      </div>
      <div className="emp-viz-tags">
        <Tag className="emp-tag dept" icon={<TeamOutlined />}>{emp.department || "—"}</Tag>
        <Tag className="emp-tag team">{emp.team || "—"}</Tag>
      </div>
      {emp.slot ? (
        <div className="emp-viz-tags">
          <Tag className="emp-tag slot">{emp.slot}</Tag>
        </div>
      ) : null}
      <div className="emp-viz-contact">
        {emp.email ? (
          <a href={`mailto:${emp.email}`} className="emp-contact-chip mail" title={emp.email} onClick={(e) => e.stopPropagation()}>
            <MailOutlined />
            <span>{emp.email}</span>
          </a>
        ) : (
          <span className="emp-contact-chip muted"><MailOutlined /> No email</span>
        )}
        {emp.mobile ? (
          <span className="emp-contact-chip phone">
            <PhoneOutlined />
            <span>{emp.mobile}</span>
          </span>
        ) : (
          <span className="emp-contact-chip muted"><PhoneOutlined /> No mobile</span>
        )}
      </div>
      {emp.reportsTo && emp.reportsTo !== "-" ? (
        <Tag className="emp-tag reports">Reports to {emp.reportsTo}</Tag>
      ) : null}
      <div className="emp-card-cta">Open profile →</div>
    </article>
  );
}

export default function AdminEmployees() {
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const [rows, setRows] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [department, setDepartment] = useState();
  const [team, setTeam] = useState();
  const [view, setView] = useState("cards");

  function openProfile(emp) {
    navigate(`/admin/employees/${emp.empId}`);
  }

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/employees", {
        params: { q: q || undefined, department: department || undefined, team: team || undefined },
      });
      setRows(data.employees || []);
      setDepartments(data.departments || []);
      setTeams(data.teams || []);
    } catch (err) {
      message.error(err.response?.data?.message || "Could not load employees");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => {
      load().catch(() => {});
    }, 200);
    return () => clearTimeout(t);
  }, [q, department, team]);

  const heads = rows.filter((r) => r.role === "Head").length;
  const managers = rows.filter((r) => r.role === "Manager").length;

  const columns = useMemo(
    () => [
      {
        title: "Employee",
        dataIndex: "name",
        fixed: "left",
        width: 240,
        render: (name, row) => (
          <button type="button" className="emp-cell linkish" onClick={() => openProfile(row)}>
            <Avatar size={40} style={{ background: hashColor(row.empId) }}>{initials(name)}</Avatar>
            <div>
              <b>{name}</b>
              <small>Emp {row.empId}</small>
            </div>
          </button>
        ),
      },
      { title: "Designation", dataIndex: "jobTitle", width: 180 },
      { title: "Department", dataIndex: "department", width: 150 },
      { title: "Team", dataIndex: "team", width: 120 },
      {
        title: "Role",
        dataIndex: "role",
        width: 110,
        render: (v) => (
          <Tag color={v === "Head" ? "blue" : v === "Manager" ? "gold" : "default"}>{v || "Member"}</Tag>
        ),
      },
      { title: "Reports To", dataIndex: "reportsTo", width: 160 },
      {
        title: "Slot",
        dataIndex: "slot",
        width: 140,
        render: (v) => (v ? <Tag className="shift-pill">{v}</Tag> : "—"),
      },
      { title: "Gender", dataIndex: "gender", width: 100 },
      { title: "DOB", dataIndex: "dateOfBirth", width: 120 },
      { title: "CNIC", dataIndex: "cnicNo", width: 160 },
      { title: "Email", dataIndex: "email", width: 220 },
      { title: "Mobile", dataIndex: "mobile", width: 130 },
      { title: "Joining", dataIndex: "joiningDate", width: 120 },
    ],
    [],
  );

  return (
    <AdminPage
      title={<><TeamOutlined /> All Employees</>}
      subtitle={`${rows.length} Softnox employees · click anyone for full profile`}
      extra={
        <Space wrap>
          <Button type="primary" icon={<UserAddOutlined />} onClick={() => navigate("/admin/employees/new")}>
            Add Employee
          </Button>
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: "cards", icon: <AppstoreOutlined />, label: "Cards" },
              { value: "list", icon: <UnorderedListOutlined />, label: "List" },
            ]}
          />
        </Space>
      }
    >
      <section className="shift-kpi-row">
        <article className="shift-kpi tone-blue">
          <div className="shift-kpi-icon"><TeamOutlined /></div>
          <div>
            <span>Total Employees</span>
            <strong>{rows.length}</strong>
          </div>
        </article>
        <article className="shift-kpi tone-green">
          <div className="shift-kpi-icon"><TeamOutlined /></div>
          <div>
            <span>Departments</span>
            <strong>{departments.length}</strong>
          </div>
        </article>
        <article className="shift-kpi tone-amber">
          <div className="shift-kpi-icon"><TeamOutlined /></div>
          <div>
            <span>Heads</span>
            <strong>{heads}</strong>
          </div>
        </article>
        <article className="shift-kpi tone-purple">
          <div className="shift-kpi-icon"><TeamOutlined /></div>
          <div>
            <span>Managers</span>
            <strong>{managers}</strong>
          </div>
        </article>
      </section>

      <div className="emp-filters">
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder="Search name, emp code, email, CNIC..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="emp-search"
        />
        <Select
          allowClear
          placeholder="Department"
          value={department}
          onChange={setDepartment}
          options={departments.map((d) => ({ value: d, label: d }))}
          className="emp-filter-select"
        />
        <Select
          allowClear
          placeholder="Team"
          value={team}
          onChange={setTeam}
          options={teams.map((t) => ({ value: t, label: t }))}
          className="emp-filter-select"
        />
      </div>

      {loading ? (
        <div className="boot" style={{ minHeight: 220 }}><Spin size="large" /></div>
      ) : view === "cards" ? (
        <section className="emp-viz-grid">
          {rows.map((emp) => (
            <EmpCard key={emp.empId} emp={emp} onOpen={openProfile} />
          ))}
          {!rows.length && (
            <Typography.Paragraph type="secondary">No employees match your filters.</Typography.Paragraph>
          )}
        </section>
      ) : (
        <Table
          className="emp-table soft-card"
          rowKey="empId"
          columns={columns}
          dataSource={rows}
          scroll={{ x: 1800 }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} employees` }}
          onRow={(record) => ({
            onClick: () => openProfile(record),
            style: { cursor: "pointer" },
          })}
        />
      )}
    </AdminPage>
  );
}
