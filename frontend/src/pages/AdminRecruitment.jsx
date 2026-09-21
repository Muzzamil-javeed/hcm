import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  App as AntApp,
  Avatar,
  Input,
  Modal,
  Progress,
  Segmented,
  Spin,
  Table,
  Tag,
  Tooltip,
} from "antd";
import {
  AppstoreOutlined,
  BankOutlined,
  CalendarOutlined,
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
  const palette = ["#2563eb", "#db2777", "#0f766e", "#7c3aed", "#d97706", "#0891b2", "#16a34a", "#ea580c", "#4f46e5"];
  let hash = 0;
  for (const ch of String(id || "")) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length];
}

const PIPE_TONES = ["blue", "green", "amber", "purple", "cyan", "rose"];

function EmpTipList({ employees = [], title, onOpenEmp }) {
  return (
    <div className="dept-tip">
      <div className="dept-tip-head">
        <b>{title}</b>
        <span>{employees.length} employees</span>
      </div>
      {employees.length ? (
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
      ) : (
        <p className="muted" style={{ margin: "8px 0 0", fontSize: 12 }}>No staff yet — open for hire</p>
      )}
    </div>
  );
}

function HireCard({ emp, onOpen }) {
  return (
    <article className="recruit-hire-card ad-enter" onClick={() => onOpen(emp)} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen(emp); }}>
      <div className="emp-viz-card-top">
        <Avatar size={48} style={{ background: hashColor(emp.empId) }}>
          {initials(emp.name)}
        </Avatar>
        <Tag color={emp.role === "Head" ? "blue" : emp.role === "Manager" ? "gold" : "default"}>
          {emp.role || "Member"}
        </Tag>
      </div>
      <h3>{emp.name}</h3>
      <div className="emp-viz-tags">
        <Tag className="emp-tag id">Emp {emp.empId}</Tag>
        <Tag className="emp-tag job">{emp.jobTitle || "Employee"}</Tag>
      </div>
      <div className="emp-viz-tags">
        <Tag className="emp-tag dept">{emp.department || "—"}</Tag>
        <Tag className="emp-tag team">{emp.team || "—"}</Tag>
      </div>
      <div className="recruit-join">
        <CalendarOutlined /> Joined {emp.joiningDate || "—"}
      </div>
      <div className="emp-card-cta">Open profile →</div>
    </article>
  );
}

export default function AdminRecruitment() {
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const [newHires, setNewHires] = useState([]);
  const [recentHires, setRecentHires] = useState([]);
  const [openRoles, setOpenRoles] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [modalRole, setModalRole] = useState(null);
  const [modalQ, setModalQ] = useState("");
  const [hireTab, setHireTab] = useState("month");
  const [hireView, setHireView] = useState("cards");
  const [hireQ, setHireQ] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/admin/recruitment");
        setNewHires(data.newHires || []);
        setRecentHires(data.recentHires || []);
        setOpenRoles(data.openRoles || []);
        setSummary(data.summary || {});
      } catch (err) {
        message.error(err.response?.data?.message || "Could not load recruitment");
      } finally {
        setLoading(false);
      }
    })().catch(() => {});
  }, [message]);

  function openEmp(emp, e) {
    e?.stopPropagation?.();
    if (!emp?.empId) return;
    setModalRole(null);
    navigate(`/admin/employees/${emp.empId}`);
  }

  function openRoleModal(role, e) {
    e?.stopPropagation?.();
    setModalQ("");
    setModalRole(role);
  }

  const hireSource = hireTab === "month" ? newHires : recentHires;
  const hireFiltered = useMemo(() => {
    const q = hireQ.trim().toLowerCase();
    if (!q) return hireSource;
    return hireSource.filter((e) =>
      [e.name, e.empId, e.department, e.team, e.jobTitle].join(" ").toLowerCase().includes(q),
    );
  }, [hireSource, hireQ]);

  const modalStaff = useMemo(() => {
    if (!modalRole) return [];
    const q = modalQ.trim().toLowerCase();
    const list = modalRole.employees || [];
    if (!q) return list;
    return list.filter((e) =>
      [e.name, e.empId, e.jobTitle, e.team, e.role].join(" ").toLowerCase().includes(q),
    );
  }, [modalRole, modalQ]);

  if (loading) {
    return (
      <AdminPage title={<><UserAddOutlined /> Recruitment</>} subtitle="Loading…">
        <div className="boot" style={{ minHeight: 240 }}><Spin size="large" /></div>
      </AdminPage>
    );
  }

  return (
    <AdminPage
      title={<><UserAddOutlined /> Recruitment</>}
      subtitle={`${summary.newHires || 0} new this month · ${summary.totalOpenings || 0} openings · Softnox pipeline`}
    >
      <section className="shift-kpi-row">
        <article className="shift-kpi tone-blue">
          <div className="shift-kpi-icon"><UserAddOutlined /></div>
          <div>
            <span>New Hires</span>
            <strong>{summary.newHires || 0}</strong>
            <small>this month</small>
          </div>
        </article>
        <article className="shift-kpi tone-amber">
          <div className="shift-kpi-icon"><BankOutlined /></div>
          <div>
            <span>Pipeline Depts</span>
            <strong>{summary.openRoles || 0}</strong>
            <small>headcount &lt; 3</small>
          </div>
        </article>
        <article className="shift-kpi tone-green">
          <div className="shift-kpi-icon"><TeamOutlined /></div>
          <div>
            <span>Open Seats</span>
            <strong>{summary.totalOpenings || 0}</strong>
            <small>to fill</small>
          </div>
        </article>
        <article className="shift-kpi tone-purple">
          <div className="shift-kpi-icon"><CalendarOutlined /></div>
          <div>
            <span>Recent (90d)</span>
            <strong>{summary.recentHires || 0}</strong>
            <small>joined</small>
          </div>
        </article>
      </section>

      <section className="recruit-section">
        <div className="recruit-section-head">
          <div>
            <h3>Hiring pipeline</h3>
            <p className="muted">Low-headcount departments · hover tooltip · click for list</p>
          </div>
        </div>

        {!openRoles.length ? (
          <div className="leave-empty soft-card">
            <BankOutlined />
            <b>No pipeline openings</b>
            <p className="muted">All departments have healthy headcount.</p>
          </div>
        ) : (
          <div className="dept-card-grid">
            {openRoles.map((r, i) => {
              const tone = PIPE_TONES[i % PIPE_TONES.length];
              const fill = Math.min(100, Math.round((r.headcount / (r.target || 3)) * 100));
              const preview = (r.employees || []).slice(0, 4);
              const tip = (
                <EmpTipList
                  employees={r.employees || []}
                  title={r.department}
                  onOpenEmp={(emp) => openEmp(emp)}
                />
              );
              return (
                <Tooltip
                  key={r.department}
                  title={tip}
                  placement="right"
                  overlayClassName="dept-tip-overlay"
                  mouseEnterDelay={0.25}
                  color="#fff"
                >
                  <button
                    type="button"
                    className={`dept-card tone-${tone}`}
                    onClick={() => openRoleModal(r)}
                  >
                    <div className="dept-card-top">
                      <div className={`dept-icon tone-${tone}`}>
                        <BankOutlined />
                      </div>
                      <Tag color="orange">{r.openings} open</Tag>
                    </div>
                    <h3>{r.department}</h3>
                    <p className="dept-head-line">
                      <span className="muted">Current headcount: <b>{r.headcount}</b> / {r.target || 3}</span>
                    </p>
                    <Progress
                      percent={fill}
                      showInfo={false}
                      size="small"
                      strokeColor={{ from: "#f59e0b", to: "#2563eb" }}
                      trailColor="#e2e8f0"
                    />
                    <div className="dept-card-meta">
                      <span>{fill}% filled</span>
                      <span>{(r.teams || []).length} teams</span>
                    </div>
                    <div className="dept-card-avatars">
                      {preview.map((e) => (
                        <button
                          key={e.empId}
                          type="button"
                          className="dept-avatar-btn"
                          title={e.name}
                          onClick={(ev) => openEmp(e, ev)}
                        >
                          <Avatar size={28} style={{ background: hashColor(e.empId) }}>
                            {initials(e.name)}
                          </Avatar>
                        </button>
                      ))}
                      {!preview.length && <span className="muted" style={{ fontSize: 12 }}>Empty seat</span>}
                      {r.headcount > preview.length && (
                        <span className="shift-more">+{r.headcount - preview.length}</span>
                      )}
                    </div>
                  </button>
                </Tooltip>
              );
            })}
          </div>
        )}
      </section>

      <section className="recruit-section soft-card recruit-hires-panel">
        <div className="shift-table-toolbar">
          <div>
            <h4>New & recent hires</h4>
            <p className="muted">
              {hireTab === "month" ? "Joined this month" : "Last 90 days"} · {hireFiltered.length} people
            </p>
          </div>
          <div className="shift-table-filters">
            <Segmented
              value={hireTab}
              onChange={setHireTab}
              options={[
                { value: "month", label: "This month" },
                { value: "recent", label: "Last 90 days" },
              ]}
            />
            <Segmented
              value={hireView}
              onChange={setHireView}
              options={[
                { value: "cards", icon: <AppstoreOutlined />, label: "Cards" },
                { value: "list", icon: <UnorderedListOutlined />, label: "List" },
              ]}
            />
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Search hires..."
              value={hireQ}
              onChange={(e) => setHireQ(e.target.value)}
              className="shift-search"
            />
          </div>
        </div>

        {hireView === "cards" ? (
          <div className="emp-viz-grid">
            {hireFiltered.map((emp) => (
              <HireCard key={emp.empId} emp={emp} onOpen={openEmp} />
            ))}
            {!hireFiltered.length && (
              <div className="leave-empty" style={{ gridColumn: "1 / -1" }}>
                <UserAddOutlined />
                <b>No hires in this period</b>
                <p className="muted">Try “Last 90 days” or check employee joining dates.</p>
              </div>
            )}
          </div>
        ) : (
          <Table
            className="emp-table"
            rowKey="empId"
            dataSource={hireFiltered}
            pagination={{ pageSize: 10, showTotal: (t) => `${t} hires` }}
            locale={{ emptyText: "No hires in this period" }}
            onRow={(record) => ({
              onClick: () => openEmp(record),
              style: { cursor: "pointer" },
            })}
            columns={[
              {
                title: "Employee",
                dataIndex: "name",
                width: 240,
                render: (n, r) => (
                  <button type="button" className="emp-cell linkish" onClick={(ev) => openEmp(r, ev)}>
                    <Avatar size={40} style={{ background: hashColor(r.empId) }}>{initials(n)}</Avatar>
                    <div>
                      <b>{n}</b>
                      <small>Emp {r.empId}</small>
                    </div>
                  </button>
                ),
              },
              { title: "Department", dataIndex: "department", width: 140 },
              { title: "Team", dataIndex: "team", width: 120 },
              {
                title: "Role",
                dataIndex: "role",
                width: 110,
                render: (v) => (
                  <Tag color={v === "Head" ? "blue" : v === "Manager" ? "gold" : "default"}>{v}</Tag>
                ),
              },
              { title: "Job title", dataIndex: "jobTitle", width: 180 },
              { title: "Joined", dataIndex: "joiningDate", width: 120 },
            ]}
          />
        )}
      </section>

      <Modal
        open={Boolean(modalRole)}
        onCancel={() => setModalRole(null)}
        footer={null}
        width={900}
        className="dept-modal"
        title={
          modalRole ? (
            <div className="dept-modal-title">
              <div className="dept-icon tone-amber"><BankOutlined /></div>
              <div>
                <b>{modalRole.department}</b>
                <small>
                  {modalRole.headcount} staff · {modalRole.openings} open seats · target {modalRole.target || 3}
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
            placeholder="Search employees in this department..."
            value={modalQ}
            onChange={(e) => setModalQ(e.target.value)}
          />
          <Tag color="orange">{modalRole?.openings} openings</Tag>
        </div>

        <Table
          className="emp-table"
          rowKey="empId"
          dataSource={modalStaff}
          pagination={{ pageSize: 8, showTotal: (t) => `${t} employees` }}
          locale={{ emptyText: "No employees yet — this seat is open for hire" }}
          onRow={(record) => ({
            onClick: () => openEmp(record),
            style: { cursor: "pointer" },
          })}
          columns={[
            {
              title: "Employee",
              dataIndex: "name",
              width: 240,
              render: (n, r) => (
                <button type="button" className="emp-cell linkish" onClick={(ev) => openEmp(r, ev)}>
                  <Avatar size={40} style={{ background: hashColor(r.empId) }}>{initials(n)}</Avatar>
                  <div>
                    <b>{n}</b>
                    <small>Emp {r.empId}</small>
                  </div>
                </button>
              ),
            },
            { title: "Job title", dataIndex: "jobTitle", render: (v) => v || "Employee" },
            { title: "Team", dataIndex: "team", render: (v) => v || "—" },
            {
              title: "Role",
              dataIndex: "role",
              render: (v) => (
                <Tag color={v === "Head" ? "blue" : v === "Manager" ? "gold" : "default"}>{v || "Member"}</Tag>
              ),
            },
            {
              title: "Slot",
              dataIndex: "slot",
              render: (v) => (v ? <Tag className="shift-pill">{v}</Tag> : "—"),
            },
          ]}
        />
      </Modal>
    </AdminPage>
  );
}
