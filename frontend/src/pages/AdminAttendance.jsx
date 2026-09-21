import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  App as AntApp,
  Avatar,
  DatePicker,
  Input,
  Modal,
  Segmented,
  Select,
  Spin,
  Table,
  Tag,
} from "antd";
import {
  AppstoreOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FieldTimeOutlined,
  MailOutlined,
  PhoneOutlined,
  SearchOutlined,
  TeamOutlined,
  UnorderedListOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import api from "../api";
import AdminPage from "../components/AdminPage";

const STATUS_COLOR = {
  Present: "success",
  Late: "warning",
  Early: "processing",
  Absent: "error",
  Missing: "magenta",
  Leave: "blue",
  OFF: "default",
  "Half Day": "cyan",
  "Short Day": "orange",
};

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

function AttCard({ row, onClick }) {
  return (
    <button type="button" className="att-card" onClick={onClick}>
      <div className="att-card-top">
        <Avatar size={48} style={{ background: hashColor(row.empId) }}>
          {initials(row.name)}
        </Avatar>
        <Tag color={STATUS_COLOR[row.status] || "default"}>{row.status}</Tag>
      </div>
      <h3>{row.name}</h3>
      <div className="emp-viz-tags">
        <Tag className="emp-tag id">Emp {row.empId}</Tag>
        <Tag className="emp-tag job">{row.jobTitle || "Employee"}</Tag>
      </div>
      <div className="emp-viz-tags">
        <Tag className="emp-tag dept">{row.department || "—"}</Tag>
        <Tag className="emp-tag team">{row.team || "—"}</Tag>
      </div>
      {row.slot ? (
        <div className="emp-viz-tags">
          <Tag className="emp-tag slot">{row.slot}</Tag>
        </div>
      ) : null}
      <div className="att-times">
        <div>
          <span>In</span>
          <b>{row.checkInLabel || "—"}</b>
        </div>
        <div>
          <span>Out</span>
          <b>{row.checkOutLabel || "—"}</b>
        </div>
        <div>
          <span>Hours</span>
          <b>{row.hours ?? "—"}</b>
        </div>
      </div>
      <div className="att-card-foot">
        <Tag className="emp-tag id">{row.punchCount} punches · View full</Tag>
      </div>
    </button>
  );
}

export default function AdminAttendance() {
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const [date, setDate] = useState(dayjs());
  const [rows, setRows] = useState([]);
  const [modalEmp, setModalEmp] = useState(null);
  const [modalLogs, setModalLogs] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [view, setView] = useState("cards");

  const dateStr = date.format("YYYY-MM-DD");

  function goFullAttendance(empId) {
    navigate(`/admin/attendance/${empId}`);
  }

  async function loadOverview() {
    setLoading(true);
    try {
      const { data: overview } = await api.get("/admin/attendance", { params: { date: dateStr } });
      setRows(overview.rows || []);
    } catch (err) {
      message.error(err.response?.data?.message || "Could not load attendance");
    } finally {
      setLoading(false);
    }
  }

  async function openFullAttendance(row) {
    setModalEmp(row);
    setModalLoading(true);
    setModalLogs([]);
    try {
      const { data } = await api.get("/admin/attendance/logs", {
        params: { date: dateStr, empId: row.empId },
      });
      setModalLogs(data.logs || []);
    } catch (err) {
      message.error(err.response?.data?.message || "Could not load punch log");
    } finally {
      setModalLoading(false);
    }
  }

  useEffect(() => {
    loadOverview().catch(() => {});
  }, [dateStr]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        String(r.empId).includes(q) ||
        String(r.department || "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, statusFilter]);

  const stats = useMemo(() => {
    const present = rows.filter((r) => ["Present", "Early", "Late"].includes(r.status)).length;
    const half = rows.filter((r) => r.status === "Half Day" || r.status === "Short Day").length;
    const late = rows.filter((r) => r.status === "Late").length;
    const avgHours = rows.length
      ? Number((rows.reduce((s, r) => s + (r.hours || 0), 0) / rows.length).toFixed(1))
      : 0;
    return { present, half, late, avgHours, total: rows.length };
  }, [rows]);

  const statuses = useMemo(
    () => [...new Set(rows.map((r) => r.status).filter(Boolean))].sort(),
    [rows],
  );

  return (
    <AdminPage
      title={<><ClockCircleOutlined /> Attendance</>}
      subtitle={`Daily attendance · ${date.format("DD MMM YYYY")} · click card for detail · open full page for history`}
      extra={
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: "cards", icon: <AppstoreOutlined />, label: "Cards" },
            { value: "list", icon: <UnorderedListOutlined />, label: "List" },
          ]}
        />
      }
    >
      <section className="shift-kpi-row">
        <article className="shift-kpi tone-blue">
          <div className="shift-kpi-icon"><TeamOutlined /></div>
          <div>
            <span>Punched In</span>
            <strong>{stats.total}</strong>
            <small>for selected day</small>
          </div>
        </article>
        <article className="shift-kpi tone-green">
          <div className="shift-kpi-icon"><CheckCircleOutlined /></div>
          <div>
            <span>Present / Late</span>
            <strong>{stats.present}</strong>
          </div>
        </article>
        <article className="shift-kpi tone-amber">
          <div className="shift-kpi-icon"><WarningOutlined /></div>
          <div>
            <span>Half / Short Day</span>
            <strong>{stats.half}</strong>
            <small>{stats.late} late</small>
          </div>
        </article>
        <article className="shift-kpi tone-purple">
          <div className="shift-kpi-icon"><FieldTimeOutlined /></div>
          <div>
            <span>Avg Hours</span>
            <strong>{stats.avgHours}</strong>
          </div>
        </article>
      </section>

      <div className="emp-filters att-filters">
        <DatePicker value={date} onChange={(d) => d && setDate(d)} className="att-date" />
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder="Search name, emp ID, department..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="emp-search"
        />
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          className="emp-filter-select"
          options={[
            { value: "all", label: "All statuses" },
            ...statuses.map((s) => ({ value: s, label: s })),
          ]}
        />
      </div>

      {loading && !rows.length ? (
        <div className="boot" style={{ minHeight: 220 }}><Spin size="large" /></div>
      ) : view === "cards" ? (
        <section className="emp-viz-grid">
          {filtered.map((row) => (
            <AttCard key={row.empId} row={row} onClick={() => openFullAttendance(row)} />
          ))}
          {!filtered.length && <p className="muted">No attendance rows for this filter.</p>}
        </section>
      ) : (
        <section className="shift-table-panel soft-card">
          <div className="shift-table-toolbar">
            <div>
              <h4>Daily summary</h4>
              <p className="muted">{filtered.length} employees · click row for full attendance</p>
            </div>
          </div>
          <Table
            className="emp-table"
            rowKey="empId"
            loading={loading}
            dataSource={filtered}
            pagination={{ pageSize: 15, showTotal: (t) => `${t} employees` }}
            onRow={(record) => ({
              onClick: () => openFullAttendance(record),
              style: { cursor: "pointer" },
            })}
            columns={[
              {
                title: "Employee",
                dataIndex: "name",
                width: 240,
                render: (n, r) => (
                  <div className="emp-cell">
                    <Avatar size={40} style={{ background: hashColor(r.empId) }}>{initials(n)}</Avatar>
                    <div>
                      <b>{n}</b>
                      <small>Emp {r.empId}</small>
                    </div>
                  </div>
                ),
              },
              {
                title: "Department",
                dataIndex: "department",
                width: 160,
                render: (v, r) => (
                  <div className="emp-viz-tags" style={{ margin: 0 }}>
                    <Tag className="emp-tag dept">{v}</Tag>
                    <Tag className="emp-tag team">{r.team}</Tag>
                  </div>
                ),
              },
              { title: "Check In", dataIndex: "checkInLabel", width: 130, render: (v) => v || "—" },
              { title: "Check Out", dataIndex: "checkOutLabel", width: 130, render: (v) => v || "—" },
              { title: "Hours", dataIndex: "hours", width: 90 },
              {
                title: "Status",
                dataIndex: "status",
                width: 120,
                render: (s) => <Tag color={STATUS_COLOR[s] || "default"}>{s}</Tag>,
              },
              { title: "Punches", dataIndex: "punchCount", width: 90 },
            ]}
          />
        </section>
      )}

      <Modal
        open={Boolean(modalEmp)}
        onCancel={() => setModalEmp(null)}
        footer={null}
        width={860}
        className="att-modal"
        destroyOnClose
        title={
          modalEmp ? (
            <div className="att-modal-title">
              <Avatar size={48} style={{ background: hashColor(modalEmp.empId) }}>
                {initials(modalEmp.name)}
              </Avatar>
              <div>
                <b>{modalEmp.name}</b>
                <small>
                  Emp {modalEmp.empId} · {date.format("DD MMM YYYY")}
                </small>
              </div>
              <Tag color={STATUS_COLOR[modalEmp.status] || "default"}>{modalEmp.status}</Tag>
            </div>
          ) : null
        }
      >
        {modalEmp && (
          <>
            <div className="emp-viz-tags att-modal-tags">
              <Tag className="emp-tag id">Emp {modalEmp.empId}</Tag>
              <Tag className="emp-tag job">{modalEmp.jobTitle || "Employee"}</Tag>
              <Tag className="emp-tag dept">{modalEmp.department || "—"}</Tag>
              <Tag className="emp-tag team">{modalEmp.team || "—"}</Tag>
              {modalEmp.slot ? <Tag className="emp-tag slot">{modalEmp.slot}</Tag> : null}
              <Tag color={STATUS_COLOR[modalEmp.status] || "default"}>{modalEmp.status}</Tag>
            </div>

            <div className="att-modal-stats">
              <div>
                <span>Check In</span>
                <strong>{modalEmp.checkInLabel || "—"}</strong>
              </div>
              <div>
                <span>Check Out</span>
                <strong>{modalEmp.checkOutLabel || "—"}</strong>
              </div>
              <div>
                <span>Hours</span>
                <strong>{modalEmp.hours ?? "—"}</strong>
              </div>
              <div>
                <span>Punches</span>
                <strong>{modalEmp.punchCount}</strong>
              </div>
            </div>

            <div className="att-modal-contact">
              {modalEmp.email ? (
                <a href={`mailto:${modalEmp.email}`} className="emp-contact-chip mail">
                  <MailOutlined /> <span>{modalEmp.email}</span>
                </a>
              ) : null}
              {modalEmp.mobile ? (
                <span className="emp-contact-chip phone">
                  <PhoneOutlined /> <span>{modalEmp.mobile}</span>
                </span>
              ) : null}
            </div>

            <div className="att-modal-actions">
              <button
                type="button"
                className="emp-btn primary"
                onClick={() => {
                  const id = modalEmp.empId;
                  setModalEmp(null);
                  goFullAttendance(id);
                }}
              >
                <ClockCircleOutlined /> Full Attendance Page
              </button>
              <button
                type="button"
                className="emp-btn ghost"
                onClick={() => {
                  const id = modalEmp.empId;
                  setModalEmp(null);
                  navigate(`/admin/employees/${id}`);
                }}
              >
                <TeamOutlined /> Employee Profile
              </button>
            </div>

            <h4 className="att-modal-section">Full punch timeline</h4>
            <Table
              className="emp-table"
              rowKey={(r) => r._id || `${r.empId}-${r.punchedAt}-${r.time}`}
              loading={modalLoading}
              dataSource={modalLogs}
              pagination={{ pageSize: 8, showTotal: (t) => `${t} punches` }}
              size="small"
              columns={[
                { title: "Time", dataIndex: "timeLabel", width: 150 },
                {
                  title: "Type",
                  dataIndex: "type",
                  width: 120,
                  render: (t) =>
                    t === 1 ? <Tag color="blue">Check In</Tag> : <Tag color="red">Check Out</Tag>,
                },
                { title: "Machine", dataIndex: "machineId", render: (v) => v || "—" },
                { title: "IP", dataIndex: "ip" },
              ]}
              locale={{ emptyText: modalLoading ? "Loading…" : "No punches found" }}
            />
          </>
        )}
      </Modal>
    </AdminPage>
  );
}
