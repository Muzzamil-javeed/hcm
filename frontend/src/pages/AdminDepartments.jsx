import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { App as AntApp, Avatar, Empty, Input, Modal, Progress, Spin, Table, Tag, Tooltip } from "antd";
import {
  BankOutlined,
  CrownOutlined,
  SearchOutlined,
  TeamOutlined,
  UserOutlined,
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

const DEPT_TONES = ["blue", "green", "amber", "purple", "cyan", "rose"];

function EmpTipList({ employees = [], department, onOpenEmp }) {
  return (
    <div className="dept-tip">
      <div className="dept-tip-head">
        <b>{department}</b>
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

export default function AdminDepartments() {
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const [rows, setRows] = useState([]);
  const [totalStaff, setTotalStaff] = useState(0);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null);
  const [modalDept, setModalDept] = useState(null);
  const [modalQ, setModalQ] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/admin/departments");
        setRows(data.departments || []);
        setTotalStaff(data.totalStaff || 0);
        if (data.departments?.length) setActive(data.departments[0].name);
      } catch (err) {
        message.error(err.response?.data?.message || "Could not load departments");
      } finally {
        setLoading(false);
      }
    })().catch(() => {});
  }, [message]);

  const modalStaff = useMemo(() => {
    if (!modalDept) return [];
    const needle = modalQ.trim().toLowerCase();
    const list = modalDept.employees || [];
    if (!needle) return list;
    return list.filter((e) =>
      [e.name, e.empId, e.jobTitle, e.role, e.team].join(" ").toLowerCase().includes(needle),
    );
  }, [modalDept, modalQ]);

  const withHeads = rows.filter((d) => d.heads?.length).length;
  const largest = rows[0];

  function openEmpProfile(emp, e) {
    e?.stopPropagation?.();
    if (!emp?.empId) return;
    setModalDept(null);
    navigate(`/admin/employees/${emp.empId}`);
  }

  function openDeptModal(dept, e) {
    e?.stopPropagation?.();
    setModalQ("");
    setModalDept(dept);
    setActive(dept.name);
  }

  if (loading) {
    return (
      <AdminPage title={<><BankOutlined /> Departments</>} subtitle="Loading…">
        <div className="boot" style={{ minHeight: 240 }}><Spin size="large" /></div>
      </AdminPage>
    );
  }

  if (!rows.length) {
    return (
      <AdminPage title={<><BankOutlined /> Departments</>}>
        <Empty description="No departments found" />
      </AdminPage>
    );
  }

  return (
    <AdminPage
      title={<><BankOutlined /> Departments</>}
      subtitle={`${rows.length} departments · ${totalStaff} Softnox employees · click department for list · avatar → profile`}
    >
      <section className="shift-kpi-row">
        <article className="shift-kpi tone-blue">
          <div className="shift-kpi-icon"><BankOutlined /></div>
          <div>
            <span>Departments</span>
            <strong>{rows.length}</strong>
          </div>
        </article>
        <article className="shift-kpi tone-green">
          <div className="shift-kpi-icon"><TeamOutlined /></div>
          <div>
            <span>Total Staff</span>
            <strong>{totalStaff}</strong>
          </div>
        </article>
        <article className="shift-kpi tone-amber">
          <div className="shift-kpi-icon"><CrownOutlined /></div>
          <div>
            <span>With Heads</span>
            <strong>{withHeads}</strong>
            <small>of {rows.length} depts</small>
          </div>
        </article>
        <article className="shift-kpi tone-purple">
          <div className="shift-kpi-icon"><UserOutlined /></div>
          <div>
            <span>Largest Team</span>
            <strong>{largest?.count || 0}</strong>
            <small>{largest?.name || "—"}</small>
          </div>
        </article>
      </section>

      <section className="dept-card-grid">
        {rows.map((d, i) => {
          const tone = DEPT_TONES[i % DEPT_TONES.length];
          const preview = (d.employees || []).slice(0, 5);
          const head = d.heads?.[0];
          const tip = (
            <EmpTipList
              employees={d.employees || []}
              department={d.name}
              onOpenEmp={(emp) => openEmpProfile(emp)}
            />
          );
          return (
            <Tooltip
              key={d.name}
              title={tip}
              placement="right"
              overlayClassName="dept-tip-overlay"
              mouseEnterDelay={0.25}
              color="#fff"
            >
              <button
                type="button"
                className={`dept-card tone-${tone}${active === d.name ? " active" : ""}`}
                onClick={() => openDeptModal(d)}
              >
                <div className="dept-card-top">
                  <div className={`dept-icon tone-${tone}`}>
                    <BankOutlined />
                  </div>
                  <Tag color="processing">{d.count} staff</Tag>
                </div>
                <h3>{d.name}</h3>
                <p className="dept-head-line">
                  {head ? (
                    <>
                      <button
                        type="button"
                        className="dept-avatar-btn"
                        title={`Open ${head.name}`}
                        onClick={(ev) => openEmpProfile(head, ev)}
                      >
                        <Avatar size={22} style={{ background: hashColor(head.empId) }}>
                          {initials(head.name)}
                        </Avatar>
                      </button>
                      <span>Head: <b>{head.name}</b></span>
                    </>
                  ) : (
                    <span className="muted">No head assigned</span>
                  )}
                </p>
                <Progress
                  percent={d.pct || 0}
                  showInfo={false}
                  size="small"
                  strokeColor={{ from: "#2563eb", to: "#38bdf8" }}
                  trailColor="#e2e8f0"
                />
                <div className="dept-card-meta">
                  <span>{d.pct}% of employees</span>
                  <span>{(d.teams || []).length} teams</span>
                </div>
                <div className="dept-card-avatars">
                  {preview.map((e) => (
                    <button
                      key={e.empId}
                      type="button"
                      className="dept-avatar-btn"
                      title={e.name}
                      onClick={(ev) => openEmpProfile(e, ev)}
                    >
                      <Avatar size={30} style={{ background: hashColor(e.empId) }}>
                        {initials(e.name)}
                      </Avatar>
                    </button>
                  ))}
                  {d.count > preview.length && (
                    <span
                      className="shift-more dept-more-btn"
                      onClick={(ev) => openDeptModal(d, ev)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter") openDeptModal(d, ev);
                      }}
                    >
                      +{d.count - preview.length}
                    </span>
                  )}
                </div>
                {(d.teams || []).length > 0 && (
                  <div className="dept-team-chips">
                    {(d.teams || []).slice(0, 3).map((t) => (
                      <Tag key={t}>{t}</Tag>
                    ))}
                  </div>
                )}
              </button>
            </Tooltip>
          );
        })}
      </section>

      <Modal
        open={Boolean(modalDept)}
        onCancel={() => setModalDept(null)}
        footer={null}
        width={920}
        className="dept-modal"
        title={
          modalDept ? (
            <div className="dept-modal-title">
              <div className="dept-icon tone-blue"><BankOutlined /></div>
              <div>
                <b>{modalDept.name}</b>
                <small>{modalDept.count} employees · {modalDept.pct}% of total</small>
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
            placeholder="Search employees in this department..."
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
            { title: "Team", dataIndex: "team", width: 120, render: (v) => v || "—" },
            {
              title: "Role",
              dataIndex: "role",
              width: 110,
              render: (v) => (
                <Tag color={v === "Head" ? "blue" : v === "Manager" ? "gold" : "default"}>{v || "Member"}</Tag>
              ),
            },
            {
              title: "Slot",
              dataIndex: "slot",
              width: 160,
              render: (v) => (v ? <Tag className="shift-pill">{v}</Tag> : "—"),
            },
          ]}
        />
      </Modal>
    </AdminPage>
  );
}
