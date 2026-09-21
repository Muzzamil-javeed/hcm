import { useEffect, useMemo, useState } from "react";
import { App as AntApp, Alert, Button, Card, Col, DatePicker, Form, Input, Row, Select, Table, Tabs, Tag, Typography } from "antd";
import api from "../api";

const TYPES = [
  { value: "casual", label: "Casual Leave" },
  { value: "annual", label: "Annual Leave" },
  { value: "sick", label: "Sick Leave" },
];

const STATUS = {
  pending: "gold",
  approved: "green",
  rejected: "red",
};

const STATUS_COLOR = {
  Present: "blue",
  "Half Day": "orange",
  Absent: "red",
  OFF: "default",
  Leave: "gold",
  "Schedule Days": "default",
  Missing: "magenta",
};

const WORKDAY_CUTOFF = "08:00:00";

function to12h(time) {
  if (!time) return "—";
  const [h, m, s] = String(time).split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, "0")}:${String(s || 0).padStart(2, "0")} ${ampm}`;
}

function clockLabel(hours) {
  const total = Math.max(0, Math.round((hours || 0) * 60));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function workDateFor(log) {
  if ((log.time || "00:00:00") < WORKDAY_CUTOFF) return addDays(log.date, -1);
  return log.date;
}

function formatDay(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${days[d.getDay()]}, ${String(d.getDate()).padStart(2, "0")}-${months[d.getMonth()]}-${d.getFullYear()}`;
}

function hoursBetween(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const [ih, im, is] = checkIn.split(":").map(Number);
  const [oh, om, os] = checkOut.split(":").map(Number);
  let start = ih * 60 + im + (is || 0) / 60;
  let end = oh * 60 + om + (os || 0) / 60;
  if (end < start) end += 24 * 60;
  return Math.max(0, (end - start) / 60);
}

function daysFromLogs(logs) {
  const map = new Map();
  for (const log of logs) {
    const workDate = workDateFor(log);
    if (!map.has(workDate)) map.set(workDate, []);
    map.get(workDate).push(log);
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([fullDate, punches]) => {
      const sorted = [...punches].sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
      const checkIn = sorted[0]?.time || null;
      const checkOut = sorted.length > 1 ? sorted.at(-1).time : null;
      const hours = Math.min(hoursBetween(checkIn, checkOut), 16);
      return {
        fullDate,
        checkIn,
        checkOut,
        hours,
        status: hours >= 9 ? "Present" : hours > 0 ? "Half Day" : "Absent",
      };
    });
}

export default function MyAttendance() {
  const { message } = AntApp.useApp();
  const [form] = Form.useForm();
  const [logs, setLogs] = useState([]);
  const [days, setDays] = useState([]);
  const [balances, setBalances] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const logRes = await api.get("/attendance/logs").catch(() => ({ data: { logs: [] } }));
      const logsList = logRes.data?.logs || [];
      setLogs(logsList);
      try {
        const { data: dash } = await api.get("/dashboard/summary");
        const chartDays = (dash.flagChart || []).filter((d) => d.status !== "Schedule Days").reverse();
        setDays(chartDays.length ? chartDays : daysFromLogs(logsList));
      } catch {
        setDays(daysFromLogs(logsList));
      }
      const [{ data: b }, { data: r }] = await Promise.all([
        api.get("/leaves/balances").catch(() => ({ data: { balances: [] } })),
        api.get("/leaves").catch(() => ({ data: { requests: [] } })),
      ]);
      setBalances(b.balances || []);
      setRequests(r.requests || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch((err) => message.error(err.response?.data?.message || "Could not load attendance"));
    const timer = setInterval(() => load().catch(() => {}), 20000);
    return () => clearInterval(timer);
  }, []);

  const punchesByDay = useMemo(() => {
    const map = new Map();
    for (const log of logs) {
      const workDate = workDateFor(log);
      if (!map.has(workDate)) map.set(workDate, []);
      map.get(workDate).push(log);
    }
    for (const list of map.values()) {
      list.sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
    }
    return map;
  }, [logs]);

  async function onFinish(values) {
    setSaving(true);
    try {
      await api.post("/leaves", {
        type: values.type,
        fromDate: values.range[0].format("YYYY-MM-DD"),
        toDate: values.range[1].format("YYYY-MM-DD"),
        reason: values.reason || "",
      });
      message.success("Leave request submitted");
      form.resetFields();
      await load();
    } catch (err) {
      message.error(err.response?.data?.message || "Could not apply leave");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Typography.Title level={4}>My Attendance</Typography.Title>
      <Tabs
        items={[
          {
            key: "logs",
            label: "Daily Attendance",
            children: (
              <Card className="soft-card">
                <div className="punch-help">
                  Har row ek office day hai (8:00 AM se next day 7:59 AM). Time In pehli punch, Time Out last punch.
                </div>
                <Table
                  className="punch-daily"
                  rowKey="fullDate"
                  loading={loading}
                  dataSource={days}
                  pagination={{ pageSize: 10, showSizeChanger: false }}
                  expandable={{
                    expandedRowRender: (row) => {
                      const punches = punchesByDay.get(row.fullDate) || [];
                      if (!punches.length) {
                        return <div className="muted">Is din koi machine punch nahi mili.</div>;
                      }
                      return (
                        <Table
                          size="small"
                          pagination={false}
                          rowKey={(p) => p._id || `${p.date}-${p.time}`}
                          dataSource={punches}
                          columns={[
                            { title: "Punch Time", dataIndex: "time", render: to12h, width: 160 },
                            {
                              title: "Type",
                              dataIndex: "type",
                              width: 120,
                              render: (t) => (t === 1 ? <Tag color="green">Check In</Tag> : <Tag color="red">Check Out</Tag>),
                            },
                            { title: "Machine", dataIndex: "machineId", render: (v) => v || "—", width: 100 },
                            { title: "IP", dataIndex: "ip", render: (v) => v || "—" },
                          ]}
                        />
                      );
                    },
                    rowExpandable: () => true,
                  }}
                  columns={[
                    {
                      title: "Date",
                      dataIndex: "fullDate",
                      render: formatDay,
                      width: 200,
                    },
                    {
                      title: "Time In",
                      dataIndex: "checkIn",
                      render: to12h,
                      width: 150,
                    },
                    {
                      title: "Time Out",
                      dataIndex: "checkOut",
                      render: to12h,
                      width: 150,
                    },
                    {
                      title: "Hours",
                      dataIndex: "hours",
                      render: clockLabel,
                      width: 90,
                    },
                    {
                      title: "Status",
                      dataIndex: "status",
                      width: 130,
                      render: (s) => <Tag color={STATUS_COLOR[s] || "default"}>{s}</Tag>,
                    },
                    {
                      title: "Punches",
                      key: "punches",
                      width: 90,
                      render: (_, row) => punchesByDay.get(row.fullDate)?.length || 0,
                    },
                  ]}
                />
              </Card>
            ),
          },
          {
            key: "leaves",
            label: "Leaves",
            children: (
              <>
                {requests.some((r) => r.status === "approved") && (
                  <Alert type="success" showIcon style={{ marginBottom: 16 }} message="Admin ne leave approve kar di hai" />
                )}
                <Row gutter={[16, 16]}>
                  {balances.map((b) => (
                    <Col xs={24} md={8} key={b.type}>
                      <Card className="soft-card"><b>{b.label}</b><div>{Number(b.balance).toFixed(2)}</div></Card>
                    </Col>
                  ))}
                  <Col xs={24} lg={10}>
                    <Card className="soft-card" title="Apply Leave">
                      <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ type: "casual" }}>
                        <Form.Item name="type" label="Leave Type" rules={[{ required: true }]}>
                          <Select options={TYPES} />
                        </Form.Item>
                        <Form.Item name="range" label="From / To" rules={[{ required: true }]}>
                          <DatePicker.RangePicker style={{ width: "100%" }} />
                        </Form.Item>
                        <Form.Item name="reason" label="Reason">
                          <Input.TextArea rows={3} />
                        </Form.Item>
                        <Button type="primary" htmlType="submit" loading={saving}>Submit Leave</Button>
                      </Form>
                    </Card>
                  </Col>
                  <Col xs={24} lg={14}>
                    <Card className="soft-card" title="My Leave Requests">
                      <Table
                        rowKey="_id"
                        loading={loading}
                        dataSource={requests}
                        pagination={{ pageSize: 8 }}
                        columns={[
                          { title: "Type", dataIndex: "type", render: (v) => v?.[0]?.toUpperCase() + v?.slice(1) },
                          { title: "From", dataIndex: "fromDate" },
                          { title: "To", dataIndex: "toDate" },
                          { title: "Days", dataIndex: "days" },
                          { title: "Reason", dataIndex: "reason", ellipsis: true },
                          {
                            title: "Status",
                            dataIndex: "status",
                            render: (s) => <Tag color={STATUS[s] || "default"}>{s}</Tag>,
                          },
                        ]}
                      />
                    </Card>
                  </Col>
                </Row>
              </>
            ),
          },
        ]}
      />
    </div>
  );
}
