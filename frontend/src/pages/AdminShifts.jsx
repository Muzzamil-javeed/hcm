import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { App as AntApp, Avatar, Input, Modal, Progress, Spin, Table, Tag, Tooltip } from "antd";
import {
  ClockCircleOutlined,
  ScheduleOutlined,
  SearchOutlined,
  TeamOutlined,
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

function EmpTipList({ employees = [], title, onOpenEmp }) {
  return (
    <div className="dept-tip">
      <div className="dept-tip-head">
        <b>{title}</b>
        <span>{employees.length} employees</span>
      </div>
      <ul className="dept-tip-list">
        {employees.map((e) => (
          <li key={e.empId}>
            <button type="button" className="dept-tip-emp" onClick={() => onOpenEmp?.(e)}>
              <Avatar size={28} style={{ background: hashColor(e.empId) }}>
                {initials(e.name)}
              </Avatar>
              <div>
                <b>{e.name}</b>
                <small>Emp {e.empId} · {e.jobTitle || "Employee"}</small>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function AdminShifts() {
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSlot, setActiveSlot] = useState(null);
  const [modalShift, setModalShift] = useState(null);
  const [modalQ, setModalQ] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/admin/shifts");
        setShifts(data.shifts || []);
        if (data.shifts?.length) setActiveSlot(data.shifts[0].slot);
      } catch (err) {
        message.error(err.response?.data?.message || "Could not load shifts");
      } finally {
        setLoading(false);
      }
    })().catch(() => {});
  }, [message]);

  const totalStaff = useMemo(
    () => shifts.reduce((sum, s) => sum + (s.count || 0), 0),
    [shifts],
  );

  const topSlot = shifts[0];

  const modalStaff = useMemo(() => {
    if (!modalShift) return [];
    const needle = modalQ.trim().toLowerCase();
    const list = modalShift.employees || [];
    if (!needle) return list;
    return list.filter((e) =>
      [e.name, e.empId, e.department, e.jobTitle, e.team, e.role].join(" ").toLowerCase().includes(needle),
    );
  }, [modalShift, modalQ]);

  function openEmpProfile(emp, e) {
    e?.stopPropagation?.();
    if (!emp?.empId) return;
    setModalShift(null);
    navigate(`/admin/employees/${emp.empId}`);
  }

  function openShiftModal(shift, e) {
    e?.stopPropagation?.();
    setModalQ("");
    setModalShift(shift);
    setActiveSlot(shift.slot);
  }

  if (loading) {
    return (
      <AdminPage title={<><ScheduleOutlined /> Shifts & Scheduling</>} subtitle="Loading…">
        <div className="boot" style={{ minHeight: 240 }}><Spin size="large" /></div>
      </AdminPage>
    );
  }

  return (
    <AdminPage
      title={<><ScheduleOutlined /> Shifts & Scheduling</>}
      subtitle={`${shifts.length} slots · ${totalStaff} employees · hover for tooltip · click for list · avatar → profile`}
    >
      <section className="shift-kpi-row">
        <article className="shift-kpi tone-blue">
          <div className="shift-kpi-icon"><ScheduleOutlined /></div>
          <div>
            <span>Total Slots</span>
            <strong>{shifts.length}</strong>
          </div>
        </article>
        <article className="shift-kpi tone-green">
          <div className="shift-kpi-icon"><TeamOutlined /></div>
          <div>
            <span>Assigned Staff</span>
            <strong>{totalStaff}</strong>
          </div>
        </article>
        <article className="shift-kpi tone-amber">
          <div className="shift-kpi-icon"><ClockCircleOutlined /></div>
          <div>
            <span>Largest Slot</span>
            <strong>{topSlot?.count || 0}</strong>
            <small>{topSlot?.slot || "—"}</small>
          </div>
        </article>
        <article className="shift-kpi tone-purple">
          <div className="shift-kpi-icon"><TeamOutlined /></div>
          <div>
            <span>Teams Covered</span>
            <strong>
              {[...new Set(shifts.flatMap((s) => (s.employees || []).map((e) => e.team).filter(Boolean)))].length}
            </strong>
          </div>
        </article>
      </section>

      <section className="shift-card-grid">
        {shifts.map((s) => {
          const pct = totalStaff ? Math.round((s.count / totalStaff) * 100) : 0;
          const preview = (s.employees || []).slice(0, 5);
          const tip = (
            <EmpTipList
              employees={s.employees || []}
              title={s.slot || "Unassigned"}
              onOpenEmp={(emp) => openEmpProfile(emp)}
            />
          );
          return (
            <Tooltip
              key={s.slot}
              title={tip}
              placement="right"
              overlayClassName="dept-tip-overlay"
              mouseEnterDelay={0.25}
              color="#fff"
            >
              <button
                type="button"
                className={`shift-card${activeSlot === s.slot ? " active" : ""}`}
                onClick={() => openShiftModal(s)}
              >
                <div className="shift-card-top">
                  <span className="shift-card-label">Slot</span>
                  <Tag color="processing">{s.count} staff</Tag>
                </div>
                <h3>{s.slot || "Unassigned"}</h3>
                <p>{s.count} employees · {pct}% of total</p>
                <Progress
                  percent={pct}
                  showInfo={false}
                  strokeColor={{ from: "#2563eb", to: "#38bdf8" }}
                  trailColor="#e2e8f0"
                  size="small"
                />
                <div className="shift-card-avatars">
                  {preview.map((e) => (
                    <button
                      key={e.empId}
                      type="button"
                      className="dept-avatar-btn"
                      title={e.name}
                      onClick={(ev) => openEmpProfile(e, ev)}
                    >
                      <Avatar size={28} style={{ background: hashColor(e.empId) }}>
                        {initials(e.name)}
                      </Avatar>
                    </button>
                  ))}
                  {s.count > preview.length && (
                    <span
                      className="shift-more dept-more-btn"
                      onClick={(ev) => openShiftModal(s, ev)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter") openShiftModal(s, ev);
                      }}
                    >
                      +{s.count - preview.length}
                    </span>
                  )}
                </div>
              </button>
            </Tooltip>
          );
        })}
      </section>

      <Modal
        open={Boolean(modalShift)}
        onCancel={() => setModalShift(null)}
        footer={null}
        width={920}
        className="dept-modal"
        title={
          modalShift ? (
            <div className="dept-modal-title">
              <div className="dept-icon tone-blue"><ScheduleOutlined /></div>
              <div>
                <b>{modalShift.slot || "Unassigned"}</b>
                <small>
                  {modalShift.count} employees ·{" "}
                  {totalStaff ? Math.round((modalShift.count / totalStaff) * 100) : 0}% of total
                </small>
              </div>
            </div>
          ) : null
        }
        destroyOnClose
      >
        <div className="dept-modal-toolbar">
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Search employees in this shift..."
            value={modalQ}
            onChange={(e) => setModalQ(e.target.value)}
          />
        </div>

        <Table
          className="emp-table"
          rowKey="empId"
          dataSource={modalStaff}
          pagination={{ pageSize: 10, showTotal: (t) => `${t} employees` }}
          locale={{ emptyText: "No employees found" }}
          onRow={(record) => ({
            onClick: () => openEmpProfile(record),
            style: { cursor: "pointer" },
          })}
          columns={[
            {
              title: "Employee",
              dataIndex: "name",
              width: 260,
              render: (n, r) => (
                <button
                  type="button"
                  className="emp-cell linkish"
                  onClick={(ev) => openEmpProfile(r, ev)}
                >
                  <Avatar size={40} style={{ background: hashColor(r.empId), flexShrink: 0 }}>
                    {initials(n)}
                  </Avatar>
                  <div>
                    <b>{n}</b>
                    <small>Emp {r.empId}</small>
                  </div>
                </button>
              ),
            },
            { title: "Job title", dataIndex: "jobTitle", width: 200, render: (v) => v || "Employee" },
            { title: "Department", dataIndex: "department", width: 140, render: (v) => v || "—" },
            { title: "Team", dataIndex: "team", width: 120, render: (v) => v || "—" },
            {
              title: "Role",
              dataIndex: "role",
              width: 110,
              render: (v) => (
                <Tag color={v === "Head" ? "blue" : v === "Manager" ? "gold" : "default"}>{v || "Member"}</Tag>
              ),
            },
          ]}
        />
      </Modal>
    </AdminPage>
  );
}
