import { useEffect, useState } from "react";
import { App as AntApp, Progress, Table, Tag } from "antd";
import { RiseOutlined } from "@ant-design/icons";
import api from "../api";
import AdminPage from "../components/AdminPage";

export default function AdminPerformance() {
  const { message } = AntApp.useApp();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/admin/performance");
        setRows(data.performance || []);
      } catch (err) {
        message.error(err.response?.data?.message || "Could not load performance");
      } finally {
        setLoading(false);
      }
    })().catch(() => {});
  }, [message]);

  const avg = rows.length
    ? Math.round(rows.reduce((s, r) => s + (r.score || 0), 0) / rows.length)
    : 0;

  return (
    <AdminPage
      title={<><RiseOutlined /> Performance</>}
      subtitle={`Role-based baseline scores · avg ${avg}`}
    >
      <div className="admin-stat-grid" style={{ marginBottom: 14 }}>
        <div className="admin-stat-card">
          <span>People scored</span>
          <strong>{rows.length}</strong>
          <small>from Softnox employees</small>
        </div>
        <div className="admin-stat-card">
          <span>Average score</span>
          <strong>{avg}</strong>
          <small>Head 90 · Manager 80 · Member 70</small>
        </div>
      </div>
      <Table
        className="emp-table soft-card"
        rowKey="empId"
        loading={loading}
        dataSource={rows}
        pagination={{ pageSize: 20 }}
        columns={[
          {
            title: "Employee",
            dataIndex: "name",
            render: (n, r) => (
              <div>
                <b>{n}</b>
                <div className="muted">Emp {r.empId}</div>
              </div>
            ),
          },
          { title: "Department", dataIndex: "department" },
          { title: "Team", dataIndex: "team" },
          { title: "Role", dataIndex: "role", render: (v) => <Tag>{v}</Tag> },
          {
            title: "Score",
            dataIndex: "score",
            width: 220,
            render: (v) => (
              <Progress
                percent={v}
                size="small"
                strokeColor={v >= 90 ? "#2563eb" : v >= 80 ? "#d97706" : "#16a34a"}
              />
            ),
          },
        ]}
      />
    </AdminPage>
  );
}
