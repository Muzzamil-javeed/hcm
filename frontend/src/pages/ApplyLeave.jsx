import { useEffect, useMemo, useState } from "react";
import {
  App as AntApp,
  Button,
  DatePicker,
  Form,
  Input,
  Progress,
  Select,
  Spin,
  Table,
  Tag,
  Upload,
} from "antd";
import {
  CalendarOutlined,
  CheckCircleOutlined,
  PaperClipOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import api from "../api";
import { useAuth } from "../context/AuthContext";

const TYPES = [
  { value: "sick", label: "Sick Leave" },
  { value: "casual", label: "Casual Leave" },
  { value: "annual", label: "Annual Leave" },
  { value: "unpaid", label: "Unpaid Leave" },
];

const DURATIONS = [
  { value: "full", label: "Full Day" },
  { value: "half", label: "Half Day" },
];

function countDays(from, to, duration) {
  if (!from || !to) return 0;
  const start = from.startOf("day");
  const end = to.startOf("day");
  const diff = end.diff(start, "day") + 1;
  const days = Math.max(1, diff);
  return duration === "half" ? Math.max(0.5, days * 0.5) : days;
}

export default function ApplyLeave() {
  const { user } = useAuth();
  const { message } = AntApp.useApp();
  const [form] = Form.useForm();
  const [balances, setBalances] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fileName, setFileName] = useState("");
  const [file, setFile] = useState(null);

  const fromDate = Form.useWatch("fromDate", form);
  const toDate = Form.useWatch("toDate", form);
  const duration = Form.useWatch("duration", form) || "full";

  const leaveDays = useMemo(
    () => countDays(fromDate, toDate, duration),
    [fromDate, toDate, duration]
  );

  async function load() {
    setLoading(true);
    try {
      const [{ data: b }, { data: r }] = await Promise.all([
        api.get("/leaves/balances"),
        api.get("/leaves"),
      ]);
      setBalances((b.balances || []).filter((x) => x.balance != null));
      setRequests(r.requests || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch((err) => message.error(err.response?.data?.message || "Could not load leaves"));
  }, [message]);

  async function onFinish(values) {
    setSaving(true);
    try {
      await api.post("/leaves", {
        type: values.type,
        duration: values.duration || "full",
        fromDate: values.fromDate.format("YYYY-MM-DD"),
        toDate: values.toDate.format("YYYY-MM-DD"),
        reason: values.reason || "",
        attachmentName: file?.name || "",
        attachmentData: file?.data || "",
      });
      message.success("Leave request submitted");
      form.resetFields();
      form.setFieldsValue({
        duration: "full",
        fromDate: dayjs(),
        toDate: dayjs(),
      });
      setFileName("");
      setFile(null);
      await load();
    } catch (err) {
      message.error(err.response?.data?.message || "Could not apply leave");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="al-boot">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="al-page">
      <section className="al-hero al-enter">
        <div>
          <h1>
            <CalendarOutlined /> Apply leave
          </h1>
          <p>Submit Softnox leave request · Sick, Casual, Annual, or Unpaid</p>
        </div>
      </section>

      <div className="al-bal-grid al-enter" style={{ animationDelay: "60ms" }}>
        {balances.map((b) => (
          <article key={b.type} className="al-bal">
            <span>{b.label}</span>
            <strong>{Number(b.balance).toFixed(1)}</strong>
            <Progress
              percent={Math.min(
                100,
                (Number(b.balance) / (b.type === "annual" ? 8 : 6)) * 100
              )}
              showInfo={false}
              size="small"
              strokeColor={b.type === "sick" ? "#f59e0b" : b.type === "annual" ? "#7c3aed" : "#2563eb"}
              trailColor="#eef2f7"
            />
          </article>
        ))}
      </div>

      <div className="al-layout al-enter" style={{ animationDelay: "100ms" }}>
        <section className="al-card">
          <header className="al-card-head">
            <h3>
              <PlusOutlined /> Add leave request
            </h3>
          </header>

          <Form
            form={form}
            layout="vertical"
            className="al-form"
            onFinish={onFinish}
            initialValues={{
              type: "casual",
              duration: "full",
              fromDate: dayjs(),
              toDate: dayjs(),
            }}
          >
            <div className="al-form-grid">
              <Form.Item label="Employee">
                <Input
                  disabled
                  value={`${user?.name || "Employee"}${user?.empId ? ` (${user.empId})` : ""}`}
                />
              </Form.Item>

              <Form.Item
                name="type"
                label="Leave type"
                rules={[{ required: true, message: "Select leave type" }]}
              >
                <Select options={TYPES} placeholder="Select one" />
              </Form.Item>

              <Form.Item
                name="duration"
                label="Leave duration"
                rules={[{ required: true }]}
              >
                <Select options={DURATIONS} />
              </Form.Item>

              <Form.Item label="Leave days">
                <Input
                  disabled
                  value={`${leaveDays.toFixed(2)} Working Day${leaveDays === 1 ? "" : "s"}`}
                />
              </Form.Item>

              <Form.Item
                name="fromDate"
                label="Leave from"
                rules={[{ required: true, message: "Select from date" }]}
              >
                <DatePicker
                  style={{ width: "100%" }}
                  format="DD/MMM/YYYY"
                  onChange={(d) => {
                    const to = form.getFieldValue("toDate");
                    if (d && to && to.isBefore(d, "day")) form.setFieldValue("toDate", d);
                  }}
                />
              </Form.Item>

              <Form.Item
                name="toDate"
                label="Leave to"
                rules={[{ required: true, message: "Select to date" }]}
              >
                <DatePicker
                  style={{ width: "100%" }}
                  format="DD/MMM/YYYY"
                  disabledDate={(current) => {
                    const from = form.getFieldValue("fromDate");
                    return from ? current && current.isBefore(from, "day") : false;
                  }}
                />
              </Form.Item>
            </div>

            <Form.Item
              name="reason"
              label="Reason"
              rules={[{ required: true, message: "Reason is required" }]}
            >
              <Input.TextArea rows={4} placeholder="Why are you applying for leave?" />
            </Form.Item>

            <div className="al-attach">
              <span>Attachment</span>
              <div className="al-attach-row">
                <Upload
                  beforeUpload={(picked) => {
                    if (picked.size > 1.5 * 1024 * 1024) {
                      message.error("Document must be under 1.5 MB");
                      return false;
                    }
                    const reader = new FileReader();
                    reader.onload = () => {
                      setFile({ name: picked.name, data: String(reader.result || "") });
                      setFileName(picked.name);
                    };
                    reader.readAsDataURL(picked);
                    return false;
                  }}
                  showUploadList={false}
                  maxCount={1}
                >
                  <Button icon={<PaperClipOutlined />}>Upload attachment</Button>
                </Upload>
                <em>{fileName || "No file selected"}</em>
              </div>
            </div>

            <Button type="primary" htmlType="submit" loading={saving} className="al-submit">
              Submit
            </Button>
          </Form>
        </section>

        <section className="al-card">
          <header className="al-card-head">
            <h3>My leave requests</h3>
            <span className="muted">{requests.length} total</span>
          </header>

          {requests.some((r) => r.status === "pending") && (
            <div className="al-alert info">
              <CheckCircleOutlined /> Leave pending with Softnox admin
            </div>
          )}

          <Table
            className="al-table"
            rowKey="_id"
            dataSource={requests}
            pagination={{ pageSize: 8, showTotal: (t) => `${t} requests` }}
            columns={[
              {
                title: "Type",
                dataIndex: "type",
                render: (v) => (
                  <Tag className="al-type-tag">{v?.[0]?.toUpperCase() + v?.slice(1)}</Tag>
                ),
              },
              { title: "From", dataIndex: "fromDate" },
              { title: "To", dataIndex: "toDate" },
              {
                title: "Days",
                dataIndex: "days",
                width: 70,
                render: (d) => Number(d).toFixed(1),
              },
              { title: "Reason", dataIndex: "reason", ellipsis: true },
              {
                title: "Status",
                dataIndex: "status",
                render: (s) => (
                  <Tag className={`al-status ${s}`}>
                    {s === "hr_approved" ? "With Admin" : s === "pending" ? "With HR" : s}
                  </Tag>
                ),
              },
            ]}
          />
        </section>
      </div>
    </div>
  );
}
