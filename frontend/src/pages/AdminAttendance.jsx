import { useEffect, useState } from "react";
import { App as AntApp, Card, DatePicker, Input, Select, Table, Tag, Typography } from "antd";
import dayjs from "dayjs";
import api from "../api";

const STATUS_COLOR = {
  Present: "green",
  Late: "gold",
  Early: "lime",
  Absent: "red",
  Missing: "magenta",
  Leave: "blue",
  OFF: "default",
  "Half Day": "cyan",
  "Short Day": "orange",
};

export default function AdminAttendance() {
  const { message } = AntApp.useApp();
  const [date, setDate] = useState(dayjs());
  const [rows, setRows] = useState([]);
  const [logs, setLogs] = useState([]);
  const [empId, setEmpId] = useState();
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const dateStr = date.format("YYYY-MM-DD");

  async function load(selectedEmp = empId) {
    setLoading(true);
    try {
      const [{ data: overview }, { data: logRes }] = await Promise.all([
        api.get("/admin/attendance", { params: { date: dateStr } }),
        api.get("/admin/attendance/logs", { params: { date: dateStr, empId: selectedEmp } }),
      ]);
      setRows(overview.rows);
      setLogs(logRes.logs);
    } catch (err) {
      message.error(err.response?.data?.message || "Could not load attendance");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(() => {});
  }, [dateStr, empId]);

  const filtered = rows.filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return r.name.toLowerCase().includes(q) || String(r.empId).includes(q);
  });

  return (
    <div>
      <Typography.Title level={4}>All Employee Attendance</Typography.Title>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <DatePicker value={date} onChange={(d) => d && setDate(d)} />
          <Input.Search
            allowClear
            placeholder="Search name or emp ID"
            style={{ width: 260 }}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            allowClear
            showSearch
            placeholder="Filter punch log by employee"
            style={{ minWidth: 280 }}
            optionFilterProp="label"
            value={empId}
            onChange={setEmpId}
            options={rows.map((r) => ({ value: r.empId, label: `${r.name} (${r.empId})` }))}
          />
        </div>
      </Card>

      <Card title={`Daily summary (${filtered.length} employees)`} style={{ marginBottom: 16 }}>
        <Table
          rowKey="empId"
          loading={loading}
          dataSource={filtered}
          pagination={{ pageSize: 15 }}
          onRow={(record) => ({
            onClick: () => setEmpId(record.empId),
            style: { cursor: "pointer" },
          })}
          columns={[
            { title: "Emp ID", dataIndex: "empId", width: 90 },
            { title: "Employee", dataIndex: "name" },
            { title: "Check In", dataIndex: "checkInLabel", render: (v) => v || "-" },
            { title: "Check Out", dataIndex: "checkOutLabel", render: (v) => v || "-" },
            { title: "Hours", dataIndex: "hours" },
            {
              title: "Status",
              dataIndex: "status",
              render: (s) => <Tag color={STATUS_COLOR[s] || "default"}>{s}</Tag>,
            },
            { title: "Punches", dataIndex: "punchCount" },
          ]}
        />
      </Card>

      <Card title="Punch times">
        <Table
          rowKey="_id"
          loading={loading}
          dataSource={logs}
          pagination={{ pageSize: 12 }}
          columns={[
            { title: "Emp ID", dataIndex: "empId", width: 90 },
            { title: "Employee", dataIndex: "employeeName" },
            { title: "Time", dataIndex: "timeLabel" },
            {
              title: "Type",
              dataIndex: "type",
              render: (t) => (t === 1 ? <Tag color="blue">Check In</Tag> : <Tag color="red">Check Out</Tag>),
            },
            { title: "Machine", dataIndex: "machineId", render: (v) => v || "-" },
            { title: "IP", dataIndex: "ip" },
          ]}
        />
      </Card>
    </div>
  );
}
