import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  App as AntApp,
  Avatar,
  Input,
  Segmented,
  Select,
  Spin,
  Table,
  Tag,
} from "antd";
import {
  AppstoreOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  SearchOutlined,
  TeamOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import api from "../api";
import AdminPage from "../components/AdminPage";

const STATUS_COLOR = {
  pending: "gold",
  approved: "success",
  rejected: "error",
};

const TYPE_COLOR = {
  casual: "blue",
  annual: "purple",
  sick: "orange",
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

function titleCase(v = "") {
  return v ? v[0].toUpperCase() + v.slice(1) : "—";
}

function LeaveCard({ row, acting, onDecide, onOpen }) {
  return (
    <article className="leave-card ad-enter">
      <div className="leave-card-top">
        <button type="button" className="leave-card-emp" onClick={() => onOpen(row)}>
          <Avatar size={48} style={{ background: hashColor(row.empId) }}>
            {initials(row.employeeName)}
          </Avatar>
          <div>
            <b>{row.employeeName}</b>
            <small>Emp {row.empId} · {row.jobTitle || "Employee"}</small>
          </div>
        </button>
        <Tag color={STATUS_COLOR[row.status] || "default"}>{titleCase(row.status)}</Tag>
      </div>

      <div className="emp-viz-tags">
        <Tag className="emp-tag job" color={TYPE_COLOR[row.type]}>{titleCase(row.type)}</Tag>
        <Tag className="emp-tag dept">{row.department || "—"}</Tag>
        <Tag className="emp-tag team">{row.team || "—"}</Tag>
      </div>

      <div className="leave-card-dates">
        <div>
          <span>From</span>
          <b>{row.fromDate}</b>
        </div>
        <div>
          <span>To</span>
          <b>{row.toDate}</b>
        </div>
        <div>
          <span>Days</span>
          <b>{row.days}</b>
        </div>
      </div>

      {row.reason ? <p className="leave-card-reason">{row.reason}</p> : null}

      {row.balances ? (
        <div className="leave-bal-row">
          <span>Casual {row.balances.casual}</span>
          <span>Annual {row.balances.annual}</span>
          <span>Sick {row.balances.sick}</span>
        </div>
      ) : null}

      {row.status === "pending" ? (
        <div className="leave-card-actions">
          <button
            type="button"
            className="emp-btn primary"
            disabled={acting === row._id}
            onClick={() => onDecide(row._id, "approved")}
          >
            <CheckCircleOutlined /> Approve
          </button>
          <button
            type="button"
            className="emp-btn ghost danger"
            disabled={acting === row._id}
            onClick={() => onDecide(row._id, "rejected")}
          >
            <CloseCircleOutlined /> Reject
          </button>
        </div>
      ) : (
        <button type="button" className="emp-btn ghost block" onClick={() => onOpen(row)}>
          View employee profile →
        </button>
      )}
    </article>
  );
}

export default function AdminLeaves() {
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const [status, setStatus] = useState("pending");
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0, total: 0 });
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [view, setView] = useState("cards");

  async function load(nextStatus = status) {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/leaves", {
        params: nextStatus === "all" ? {} : { status: nextStatus },
      });
      setRows(data.requests || []);
      if (data.counts) setCounts(data.counts);
    } catch (err) {
      message.error(err.response?.data?.message || "Could not load leaves");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(() => {});
  }, [status]);

  async function decide(id, next) {
    setActing(id);
    try {
      await api.patch(`/leaves/${id}`, { status: next });
      message.success(next === "approved" ? "Leave approved" : "Leave rejected");
      await load();
    } catch (err) {
      message.error(err.response?.data?.message || "Update failed");
    } finally {
      setActing(undefined);
    }
  }

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        String(r.employeeName || "").toLowerCase().includes(q) ||
        String(r.empId).includes(q) ||
        String(r.department || "").toLowerCase().includes(q) ||
        String(r.reason || "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, typeFilter]);

  const types = useMemo(
    () => [...new Set(rows.map((r) => r.type).filter(Boolean))],
    [rows],
  );

  const columns = [
    {
      title: "Employee",
      dataIndex: "employeeName",
      width: 240,
      render: (name, row) => (
        <button type="button" className="emp-cell linkish" onClick={() => navigate(`/admin/employees/${row.empId}`)}>
          <Avatar size={40} style={{ background: hashColor(row.empId) }}>{initials(name)}</Avatar>
          <div>
            <b>{name}</b>
            <small>Emp {row.empId}</small>
          </div>
        </button>
      ),
    },
    {
      title: "Type",
      dataIndex: "type",
      width: 110,
      render: (v) => <Tag color={TYPE_COLOR[v] || "default"}>{titleCase(v)}</Tag>,
    },
    { title: "Department", dataIndex: "department", width: 140 },
    { title: "From", dataIndex: "fromDate", width: 120 },
    { title: "To", dataIndex: "toDate", width: 120 },
    { title: "Days", dataIndex: "days", width: 80 },
    { title: "Reason", dataIndex: "reason", ellipsis: true },
    {
      title: "Status",
      dataIndex: "status",
      width: 110,
      render: (s) => <Tag color={STATUS_COLOR[s] || "default"}>{titleCase(s)}</Tag>,
    },
    {
      title: "Action",
      width: 200,
      render: (_, row) =>
        row.status === "pending" ? (
          <div className="leave-table-actions">
            <button type="button" className="emp-btn primary sm" disabled={acting === row._id} onClick={() => decide(row._id, "approved")}>
              Approve
            </button>
            <button type="button" className="emp-btn ghost danger sm" disabled={acting === row._id} onClick={() => decide(row._id, "rejected")}>
              Reject
            </button>
          </div>
        ) : (
          <span className="muted">—</span>
        ),
    },
  ];

  return (
    <AdminPage
      title={<><CalendarOutlined /> Leave Approvals</>}
      subtitle="Review and decide Softnox leave requests · cards or list"
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
        <article
          className={`shift-kpi tone-amber${status === "pending" ? " is-active" : ""}`}
          role="button"
          tabIndex={0}
          onClick={() => setStatus("pending")}
          onKeyDown={(e) => e.key === "Enter" && setStatus("pending")}
        >
          <div className="shift-kpi-icon"><ClockCircleOutlined /></div>
          <div>
            <span>Pending</span>
            <strong>{counts.pending || 0}</strong>
            <small>awaiting decision</small>
          </div>
        </article>
        <article
          className={`shift-kpi tone-green${status === "approved" ? " is-active" : ""}`}
          role="button"
          tabIndex={0}
          onClick={() => setStatus("approved")}
          onKeyDown={(e) => e.key === "Enter" && setStatus("approved")}
        >
          <div className="shift-kpi-icon"><CheckCircleOutlined /></div>
          <div>
            <span>Approved</span>
            <strong>{counts.approved || 0}</strong>
          </div>
        </article>
        <article
          className={`shift-kpi tone-purple${status === "rejected" ? " is-active" : ""}`}
          role="button"
          tabIndex={0}
          onClick={() => setStatus("rejected")}
          onKeyDown={(e) => e.key === "Enter" && setStatus("rejected")}
        >
          <div className="shift-kpi-icon"><CloseCircleOutlined /></div>
          <div>
            <span>Rejected</span>
            <strong>{counts.rejected || 0}</strong>
          </div>
        </article>
        <article
          className={`shift-kpi tone-blue${status === "all" ? " is-active" : ""}`}
          role="button"
          tabIndex={0}
          onClick={() => setStatus("all")}
          onKeyDown={(e) => e.key === "Enter" && setStatus("all")}
        >
          <div className="shift-kpi-icon"><TeamOutlined /></div>
          <div>
            <span>All Requests</span>
            <strong>{counts.total || 0}</strong>
          </div>
        </article>
      </section>

      <div className="emp-filters">
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder="Search name, emp ID, department, reason..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="emp-search"
        />
        <Select
          value={status}
          onChange={setStatus}
          className="emp-filter-select"
          options={[
            { value: "pending", label: "Pending" },
            { value: "approved", label: "Approved" },
            { value: "rejected", label: "Rejected" },
            { value: "all", label: "All statuses" },
          ]}
        />
        <Select
          value={typeFilter}
          onChange={setTypeFilter}
          className="emp-filter-select"
          options={[
            { value: "all", label: "All types" },
            ...types.map((t) => ({ value: t, label: titleCase(t) })),
          ]}
        />
      </div>

      {loading && !rows.length ? (
        <div className="boot" style={{ minHeight: 220 }}><Spin size="large" /></div>
      ) : view === "cards" ? (
        <section className="emp-viz-grid">
          {filtered.map((row) => (
            <LeaveCard
              key={row._id}
              row={row}
              acting={acting}
              onDecide={decide}
              onOpen={(r) => navigate(`/admin/employees/${r.empId}`)}
            />
          ))}
          {!filtered.length && (
            <div className="leave-empty soft-card">
              <CalendarOutlined />
              <b>No leave requests</b>
              <p className="muted">Nothing matches this filter right now.</p>
            </div>
          )}
        </section>
      ) : (
        <section className="shift-table-panel soft-card">
          <div className="shift-table-toolbar">
            <div>
              <h4>Leave requests</h4>
              <p className="muted">{filtered.length} shown · Softnox approvals</p>
            </div>
          </div>
          <Table
            className="emp-table"
            rowKey="_id"
            loading={loading}
            dataSource={filtered}
            columns={columns}
            pagination={{ pageSize: 12, showTotal: (t) => `${t} requests` }}
            scroll={{ x: 1100 }}
            locale={{ emptyText: "No leave requests" }}
          />
        </section>
      )}
    </AdminPage>
  );
}
