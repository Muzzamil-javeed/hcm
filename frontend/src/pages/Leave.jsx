import { useEffect, useState } from "react";
import { App as AntApp, Alert, Button, Card, Col, DatePicker, Form, Input, Row, Select, Statistic, Table, Tag, Typography } from "antd";
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

export default function Leave() {
  const { message } = AntApp.useApp();
  const [form] = Form.useForm();
  const [balances, setBalances] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [{ data: b }, { data: r }] = await Promise.all([
        api.get("/leaves/balances"),
        api.get("/leaves"),
      ]);
      setBalances(b.balances);
      setRequests(r.requests);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch((err) => message.error(err.response?.data?.message || "Could not load leaves"));
    const timer = setInterval(() => {
      load().catch(() => {});
    }, 15000);
    return () => clearInterval(timer);
  }, []);

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
      <Typography.Title level={4}>Leaves</Typography.Title>
      {requests.some((r) => r.status === "approved") && (
        <Alert
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
          message="Admin ne leave approve kar di hai"
          description="Approved requests neeche Status column mein green Approved dikhengi."
        />
      )}
      {requests.some((r) => r.status === "pending") && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Leave admin ke paas pending hai"
        />
      )}
      <Row gutter={[16, 16]}>
        {balances.map((b) => (
          <Col xs={24} md={8} key={b.type}>
            <Card>
              <Statistic title={b.label} value={Number(b.balance)} precision={2} />
            </Card>
          </Col>
        ))}
        <Col xs={24} lg={10}>
          <Card title="Add Leave">
            <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ type: "casual" }}>
              <Form.Item name="type" label="Leave Type" rules={[{ required: true }]}>
                <Select options={TYPES} />
              </Form.Item>
              <Form.Item name="range" label="From / To" rules={[{ required: true, message: "Select dates" }]}>
                <DatePicker.RangePicker style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name="reason" label="Reason">
                <Input.TextArea rows={3} />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={saving}>
                Submit Leave
              </Button>
            </Form>
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card title="My Leave Requests">
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
    </div>
  );
}
