import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { App as AntApp, Avatar, Input, Progress, Select, Table, Tag } from "antd";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  FileProtectOutlined,
  FileTextOutlined,
  SearchOutlined,
  WarningOutlined,
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
  const palette = ["#2563eb", "#db2777", "#0f766e", "#7c3aed", "#d97706", "#0891b2", "#16a34a", "#ea580c", "#4f46e5"];
  let hash = 0;
  for (const ch of String(id || "")) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length];
}

function FieldChip({ ok, label }) {
  return (
    <span className={`doc-chip ${ok ? "ok" : "bad"}`}>
      {ok ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
      {label}
    </span>
  );
}

const MISSING_LABEL = {
  email: "Email",
  cnic: "CNIC",
  mobile: "Mobile",
  dob: "Date of Birth",
};

export default function AdminDocuments() {
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [department, setDepartment] = useState();

  function openProfile(empId) {
    if (!empId) return;
    navigate(`/admin/employees/${empId}`);
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/admin/documents");
        setRows(data.documents || []);
      } catch (err) {
        message.error(err.response?.data?.message || "Could not load documents");
      } finally {
        setLoading(false);
      }
    })().catch(() => {});
  }, [message]);

  const stats = useMemo(() => {
    const complete = rows.filter((r) => r.score === 100).length;
    const incomplete = rows.length - complete;
    const avg = rows.length
      ? Math.round(rows.reduce((s, r) => s + (r.score || 0), 0) / rows.length)
      : 0;
    const missingDob = rows.filter((r) => r.missing?.includes("dob")).length;
    return { complete, incomplete, avg, missingDob };
  }, [rows]);

  const departments = useMemo(
    () => [...new Set(rows.map((r) => r.department).filter(Boolean))].sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filter === "complete" && r.score !== 100) return false;
      if (filter === "incomplete" && r.score === 100) return false;
      if (department && r.department !== department) return false;
      const needle = q.trim().toLowerCase();
      if (!needle) return true;
      return [r.name, r.empId, r.department, r.jobTitle, ...(r.missing || [])]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [rows, filter, q, department]);

  return (
    <AdminPage
      title={<><FileTextOutlined /> Documents</>}
      subtitle={`Profile completeness · ${stats.incomplete} employees need attention`}
    >
      <section className="shift-kpi-row">
        <article className="shift-kpi tone-blue">
          <div className="shift-kpi-icon"><FileProtectOutlined /></div>
          <div>
            <span>Profiles Checked</span>
            <strong>{rows.length}</strong>
            <small>email · CNIC · mobile · DOB</small>
          </div>
        </article>
        <article className="shift-kpi tone-green">
          <div className="shift-kpi-icon"><CheckCircleOutlined /></div>
          <div>
            <span>Complete</span>
            <strong>{stats.complete}</strong>
            <small>100% profile</small>
          </div>
        </article>
        <article className="shift-kpi tone-amber">
          <div className="shift-kpi-icon"><WarningOutlined /></div>
          <div>
            <span>Incomplete</span>
            <strong>{stats.incomplete}</strong>
            <small>need attention</small>
          </div>
        </article>
        <article className="shift-kpi tone-purple">
          <div className="shift-kpi-icon"><FileTextOutlined /></div>
          <div>
            <span>Avg Completeness</span>
            <strong>{stats.avg}%</strong>
            <small>{stats.missingDob} missing DOB</small>
          </div>
        </article>
      </section>

      <section className="doc-filter-row">
        {[
          { key: "all", label: "All Profiles", count: rows.length, tone: "blue" },
          { key: "complete", label: "Complete", count: stats.complete, tone: "green" },
          { key: "incomplete", label: "Needs Attention", count: stats.incomplete, tone: "amber" },
        ].map((c) => (
          <button
            key={c.key}
            type="button"
            className={`doc-filter-card tone-${c.tone}${filter === c.key ? " active" : ""}`}
            onClick={() => setFilter(c.key)}
          >
            <span>{c.label}</span>
            <strong>{c.count}</strong>
            <Progress
              percent={rows.length ? Math.round((c.count / rows.length) * 100) : 0}
              showInfo={false}
              size="small"
              strokeColor={c.tone === "green" ? "#16a34a" : c.tone === "amber" ? "#d97706" : "#2563eb"}
              trailColor="#e2e8f0"
            />
          </button>
        ))}
      </section>

      <section className="shift-table-panel soft-card">
        <div className="shift-table-toolbar">
          <div>
            <h4>Employee Documents</h4>
            <p className="muted">{filtered.length} profiles in view</p>
          </div>
          <div className="shift-table-filters">
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Search name, emp code, dept..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="shift-search"
            />
            <Select
              allowClear
              placeholder="Department"
              value={department}
              onChange={setDepartment}
              options={departments.map((d) => ({ value: d, label: d }))}
              className="shift-team-select"
              style={{ minWidth: 160 }}
            />
          </div>
        </div>

        <Table
          className="emp-table"
          rowKey="empId"
          loading={loading}
          dataSource={filtered}
          pagination={{ pageSize: 15, showSizeChanger: true, showTotal: (t) => `${t} employees` }}
          scroll={{ x: 1100 }}
          columns={[
            {
              title: "Employee",
              dataIndex: "name",
              width: 240,
              fixed: "left",
              render: (n, r) => (
                <button type="button" className="emp-cell linkish" onClick={() => openProfile(r.empId)}>
                  <span className="doc-dp-wrap">
                    <Avatar size={40} style={{ background: hashColor(r.empId), flexShrink: 0 }}>
                      {initials(n)}
                    </Avatar>
                  </span>
                  <div>
                    <b>{n}</b>
                    <small>Emp {r.empId}</small>
                  </div>
                </button>
              ),
            },
            { title: "Department", dataIndex: "department", width: 150 },
            {
              title: "Document Fields",
              key: "flags",
              width: 320,
              render: (_, r) => (
                <div className="doc-chip-row">
                  <FieldChip ok={r.hasEmail} label="Email" />
                  <FieldChip ok={r.hasCnic} label="CNIC" />
                  <FieldChip ok={r.hasMobile} label="Mobile" />
                  <FieldChip ok={r.hasDob} label="DOB" />
                </div>
              ),
            },
            {
              title: "Score",
              dataIndex: "score",
              width: 170,
              sorter: (a, b) => a.score - b.score,
              render: (v) => (
                <div className="doc-score">
                  <Progress
                    percent={v}
                    size="small"
                    status={v === 100 ? "success" : "active"}
                    strokeColor={v === 100 ? "#16a34a" : v >= 75 ? "#2563eb" : "#ea580c"}
                  />
                  <em>{v}%</em>
                </div>
              ),
            },
            {
              title: "Missing",
              dataIndex: "missing",
              width: 180,
              render: (m) =>
                m?.length ? (
                  <div className="doc-missing">
                    {m.map((x) => (
                      <Tag key={x} color="error">{MISSING_LABEL[x] || x}</Tag>
                    ))}
                  </div>
                ) : (
                  <Tag icon={<CheckCircleOutlined />} color="success">Complete</Tag>
                ),
            },
            {
              title: "Action",
              key: "action",
              width: 150,
              fixed: "right",
              render: (_, r) => (
                <button
                  type="button"
                  className="doc-view-btn"
                  onClick={() => openProfile(r.empId)}
                >
                  <EyeOutlined />
                  View Details
                </button>
              ),
            },
          ]}
        />
      </section>
    </AdminPage>
  );
}
