import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  App as AntApp,
  Avatar,
  Input,
  Spin,
  Table,
  Tag,
} from "antd";
import {
  AuditOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import api from "../api";
import AdminPage from "../components/AdminPage";

const LEAVE_STATUS = {
  pending: { color: "gold", className: "aud-tag pending" },
  approved: { color: "green", className: "aud-tag approved" },
  rejected: { color: "red", className: "aud-tag rejected" },
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

export default function AdminAudit() {
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const [attendance, setAttendance] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("att");
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/admin/audit");
        setAttendance(data.attendance || []);
        setLeaves(data.leaves || []);
      } catch (err) {
        message.error(err.response?.data?.message || "Could not load audit logs");
      } finally {
        setLoading(false);
      }
    })().catch(() => {});
  }, [message]);

  function openEmp(empId, e) {
    e?.stopPropagation?.();
    if (!empId) return;
    navigate(`/admin/employees/${empId}`);
  }

  const checkIns = useMemo(
    () => attendance.filter((a) => a.typeLabel === "Check In").length,
    [attendance]
  );
  const checkOuts = useMemo(
    () => attendance.filter((a) => a.typeLabel === "Check Out").length,
    [attendance]
  );

  const filteredAtt = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return attendance;
    return attendance.filter((r) =>
      [r.employeeName, r.empId, r.typeLabel, r.source, r.date].join(" ").toLowerCase().includes(needle)
    );
  }, [attendance, q]);

  const filteredLeaves = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return leaves;
    return leaves.filter((r) =>
      [r.employeeName, r.empId, r.type, r.status].join(" ").toLowerCase().includes(needle)
    );
  }, [leaves, q]);

  function EmpCell({ name, empId }) {
    return (
      <button type="button" className="aud-emp-cell" onClick={(e) => openEmp(empId, e)}>
        <Avatar size={40} style={{ background: hashColor(empId), flexShrink: 0 }}>
          {initials(name)}
        </Avatar>
        <span>
          <b>{name || "—"}</b>
          <small>Emp {empId}</small>
        </span>
      </button>
    );
  }

  if (loading && !attendance.length && !leaves.length) {
    return (
      <AdminPage title={<><AuditOutlined /> Audit Logs</>} subtitle="Loading…">
        <div className="boot"><Spin size="large" /></div>
      </AdminPage>
    );
  }

  return (
    <AdminPage
      title={<><AuditOutlined /> Audit Logs</>}
      subtitle="Recent attendance punches and leave status changes"
    >
      <section className="aud-kpis">
        <article className="aud-kpi tone-navy aud-enter">
          <div className="aud-kpi-icon"><AuditOutlined /></div>
          <div>
            <span>Attendance events</span>
            <strong>{attendance.length}</strong>
            <small>recent punches</small>
          </div>
        </article>
        <article className="aud-kpi tone-blue aud-enter" style={{ animationDelay: "60ms" }}>
          <div className="aud-kpi-icon"><CheckCircleOutlined /></div>
          <div>
            <span>Check ins</span>
            <strong>{checkIns}</strong>
            <small>in this feed</small>
          </div>
        </article>
        <article className="aud-kpi tone-amber aud-enter" style={{ animationDelay: "120ms" }}>
          <div className="aud-kpi-icon"><ClockCircleOutlined /></div>
          <div>
            <span>Check outs</span>
            <strong>{checkOuts}</strong>
            <small>in this feed</small>
          </div>
        </article>
        <article className="aud-kpi tone-purple aud-enter" style={{ animationDelay: "180ms" }}>
          <div className="aud-kpi-icon"><CalendarOutlined /></div>
          <div>
            <span>Leave updates</span>
            <strong>{leaves.length}</strong>
            <small>status changes</small>
          </div>
        </article>
      </section>

      <section className="aud-panel aud-enter" style={{ animationDelay: "220ms" }}>
        <div className="aud-toolbar">
          <div className="aud-tabs">
            <button
              type="button"
              className={tab === "att" ? "active" : ""}
              onClick={() => setTab("att")}
            >
              Attendance <em>{attendance.length}</em>
            </button>
            <button
              type="button"
              className={tab === "leave" ? "active" : ""}
              onClick={() => setTab("leave")}
            >
              Leave <em>{leaves.length}</em>
            </button>
          </div>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Search employee, type, status…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="aud-search"
          />
        </div>

        {tab === "att" ? (
          <Table
            className="emp-table soft-card aud-table"
            rowKey={(r) => `${r.empId}-${r.punchedAt}-${r.time}`}
            loading={loading}
            dataSource={filteredAtt}
            pagination={{ pageSize: 15, showTotal: (t) => `${t} events` }}
            onRow={(r) => ({
              onClick: () => openEmp(r.empId),
              className: "aud-row-click",
            })}
            columns={[
              {
                title: "Employee",
                dataIndex: "employeeName",
                render: (n, r) => <EmpCell name={n} empId={r.empId} />,
              },
              { title: "Date", dataIndex: "date", width: 120 },
              { title: "Time", dataIndex: "timeLabel", width: 120 },
              {
                title: "Type",
                dataIndex: "typeLabel",
                width: 120,
                render: (v) => (
                  <Tag className={v === "Check In" ? "aud-tag checkin" : "aud-tag checkout"}>{v}</Tag>
                ),
              },
              {
                title: "Source",
                dataIndex: "source",
                width: 100,
                render: (v) => <span className="aud-source">{v || "—"}</span>,
              },
              {
                title: "Logged at",
                dataIndex: "punchedAt",
                width: 140,
                render: (v) => (v ? dayjs(v).format("DD MMM, HH:mm") : "—"),
              },
            ]}
          />
        ) : (
          <Table
            className="emp-table soft-card aud-table"
            rowKey={(r) => `${r.empId}-${r.updatedAt}-${r.fromDate}`}
            loading={loading}
            dataSource={filteredLeaves}
            pagination={{ pageSize: 15, showTotal: (t) => `${t} updates` }}
            onRow={(r) => ({
              onClick: () => openEmp(r.empId),
              className: "aud-row-click",
            })}
            columns={[
              {
                title: "Employee",
                dataIndex: "employeeName",
                render: (n, r) => <EmpCell name={n} empId={r.empId} />,
              },
              {
                title: "Type",
                dataIndex: "type",
                render: (v) => <Tag className="aud-tag leave-type">{v}</Tag>,
              },
              {
                title: "Status",
                dataIndex: "status",
                render: (s) => {
                  const meta = LEAVE_STATUS[s] || { className: "aud-tag" };
                  return <Tag className={meta.className}>{s}</Tag>;
                },
              },
              { title: "From", dataIndex: "fromDate", width: 120 },
              { title: "To", dataIndex: "toDate", width: 120 },
              { title: "Days", dataIndex: "days", width: 70 },
              {
                title: "Updated",
                dataIndex: "updatedAt",
                width: 140,
                render: (v) => (v ? dayjs(v).format("DD MMM, HH:mm") : "—"),
              },
            ]}
          />
        )}
      </section>
    </AdminPage>
  );
}
