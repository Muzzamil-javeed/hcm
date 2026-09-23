import { useEffect, useMemo, useState } from "react";
import {
  App as AntApp,
  Avatar,
  Button,
  DatePicker,
  Empty,
  Form,
  Input,
  Select,
  Spin,
  Tag,
  Upload,
} from "antd";
import {
  BellOutlined,
  DeleteOutlined,
  EditOutlined,
  NotificationOutlined,
  PaperClipOutlined,
  PlusOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import api, { openAnnouncementPdf } from "../api";
import AdminPage from "../components/AdminPage";

dayjs.extend(relativeTime);

const AUDIENCE_META = {
  all: { label: "Everyone", tone: "blue", icon: <BellOutlined /> },
  employees: { label: "Employees", tone: "green", icon: <TeamOutlined /> },
  admin: { label: "Admins", tone: "purple", icon: <UserOutlined /> },
};

function authorInitials(name = "S") {
  return String(name)
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "SY";
}

export default function AdminAnnouncements() {
  const { message, modal } = AntApp.useApp();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("all");
  const [editingId, setEditingId] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfName, setPdfName] = useState("");
  const [form] = Form.useForm();

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/announcements");
      setRows(data.announcements || []);
    } catch (err) {
      message.error(err.response?.data?.message || "Could not load announcements");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(() => {});
  }, []);

  async function onCreate(values) {
    setSaving(true);
    try {
      const payload = {
        ...values,
        startDate: values.startDate?.format?.("YYYY-MM-DD") || "",
        endDate: values.endDate?.format?.("YYYY-MM-DD") || "",
      };
      if (pdfFile) {
        payload.documentName = pdfFile.name;
        payload.documentData = pdfFile.data;
      }
      if (editingId) {
        await api.patch(`/admin/announcements/${editingId}`, payload);
        message.success("Announcement updated");
      } else {
        await api.post("/admin/announcements", payload);
        message.success("Announcement published");
      }
      setEditingId(null);
      setPdfFile(null);
      setPdfName("");
      form.resetFields();
      form.setFieldsValue({ audience: "all" });
      await load();
    } catch (err) {
      message.error(err.response?.data?.message || "Could not save announcement");
    } finally {
      setSaving(false);
    }
  }

  function onDelete(row) {
    modal.confirm({
      title: "Delete this announcement?",
      content: "This post will be removed from HR, employees, and the notification bell.",
      okText: "Delete",
      okButtonProps: { danger: true },
      cancelText: "Cancel",
      onOk: async () => {
        await api.delete(`/admin/announcements/${row._id}`);
        if (editingId === row._id) {
          setEditingId(null);
          form.resetFields();
          form.setFieldsValue({ audience: "all" });
        }
        message.success("Announcement deleted");
        await load();
      },
    });
  }

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter((a) => a.audience === filter);
  }, [rows, filter]);

  const counts = useMemo(() => {
    const c = { all: rows.length, employees: 0, admin: 0 };
    for (const a of rows) {
      if (a.audience === "employees") c.employees += 1;
      if (a.audience === "admin") c.admin += 1;
    }
    return c;
  }, [rows]);

  return (
    <AdminPage
      title={<><NotificationOutlined /> Announcements</>}
      subtitle={`${rows.length} posts for Softnox team`}
    >
      <div className="ann-layout">
        <aside className="ann-composer ann-enter" style={{ animationDelay: "40ms" }}>
          <header className="ann-composer-head">
            <div className="ann-composer-icon">
              <PlusOutlined />
            </div>
            <div>
              <h3>{editingId ? "Edit announcement" : "Create announcement"}</h3>
              <p>{editingId ? "Update this post. Employees see the new text." : "Publish a note to Softnox employees or admins."}</p>
            </div>
          </header>

          <Form
            form={form}
            layout="vertical"
            className="ann-form"
            onFinish={onCreate}
            initialValues={{ audience: "all" }}
          >
            <Form.Item name="title" label="Title" rules={[{ required: true, message: "Title required" }]}>
              <Input placeholder="e.g. Office holiday notice" maxLength={120} showCount />
            </Form.Item>
            <Form.Item name="body" label="Message" rules={[{ required: true, message: "Message required" }]}>
              <Input.TextArea rows={5} placeholder="Write the announcement…" maxLength={2000} showCount />
            </Form.Item>
            <div className="hr-ann-dates">
              <Form.Item name="startDate" label="Show from" rules={[{ required: true, message: "Start date required" }]}>
                <DatePicker style={{ width: "100%" }} format="DD MMM YYYY" />
              </Form.Item>
              <Form.Item name="endDate" label="Show until" rules={[{ required: true, message: "End date required" }]}>
                <DatePicker style={{ width: "100%" }} format="DD MMM YYYY" />
              </Form.Item>
            </div>
            <div className="hr-ann-pdf">
              <span>Policy PDF</span>
              <Upload
                accept="application/pdf,.pdf"
                maxCount={1}
                showUploadList={false}
                beforeUpload={(file) => {
                  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
                  if (!isPdf) {
                    message.error("Only PDF allowed");
                    return false;
                  }
                  if (file.size > 4 * 1024 * 1024) {
                    message.error("PDF must be under 4 MB");
                    return false;
                  }
                  const reader = new FileReader();
                  reader.onload = () => {
                    setPdfFile({ name: file.name, data: String(reader.result || "") });
                    setPdfName(file.name);
                  };
                  reader.readAsDataURL(file);
                  return false;
                }}
              >
                <Button icon={<PaperClipOutlined />}>Upload PDF</Button>
              </Upload>
              <em>{pdfName || "Only PDF. Everyone with this post can open it."}</em>
            </div>
            <Form.Item name="audience" label="Audience">
              <Select
                options={[
                  { value: "all", label: "Everyone" },
                  { value: "employees", label: "Employees only" },
                  { value: "admin", label: "Admins only" },
                ]}
              />
            </Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              icon={<PlusOutlined />}
              loading={saving}
              className="ann-publish"
              block
            >
              {editingId ? "Save changes" : "Publish announcement"}
            </Button>
            {editingId ? (
              <Button
                block
                style={{ marginTop: 8 }}
                onClick={() => {
                  setEditingId(null);
                  setPdfFile(null);
                  setPdfName("");
                  form.resetFields();
                  form.setFieldsValue({ audience: "all" });
                }}
              >
                Cancel edit
              </Button>
            ) : null}
          </Form>
        </aside>

        <section className="ann-feed">
          <div className="ann-feed-toolbar ann-enter" style={{ animationDelay: "80ms" }}>
            <h3>Recent posts</h3>
            <div className="ann-filters">
              {[
                { key: "all", label: "All", count: counts.all },
                { key: "employees", label: "Employees", count: counts.employees },
                { key: "admin", label: "Admins", count: counts.admin },
              ].map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className={`ann-filter ${filter === f.key ? "active" : ""}`}
                  onClick={() => setFilter(f.key)}
                >
                  {f.label}
                  <em>{f.count}</em>
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="ann-loading">
              <Spin size="large" />
            </div>
          ) : !filtered.length ? (
            <div className="ann-empty ann-enter">
              <Empty description={filter === "all" ? "No announcements yet" : "No posts in this audience"} />
            </div>
          ) : (
            <ul className="ann-list">
              {filtered.map((a, i) => {
                const meta = AUDIENCE_META[a.audience] || AUDIENCE_META.all;
                const author = a.createdBy || "system";
                return (
                  <li
                    key={a._id}
                    className="ann-card ann-enter"
                    style={{ animationDelay: `${120 + i * 45}ms` }}
                  >
                    <div className={`ann-card-rail tone-${meta.tone}`} />
                    <div className="ann-card-body">
                      <div className="ann-card-top">
                        <Avatar size={40} className={`ann-avatar tone-${meta.tone}`}>
                          {authorInitials(author)}
                        </Avatar>
                        <div className="ann-card-meta">
                          <div className="ann-card-tags">
                            <Tag className={`ann-aud tone-${meta.tone}`} icon={meta.icon}>
                              {meta.label}
                            </Tag>
                            <span className="ann-time" title={a.createdAt ? dayjs(a.createdAt).format("DD MMM YYYY, HH:mm") : ""}>
                              {a.createdAt ? dayjs(a.createdAt).fromNow() : ""}
                            </span>
                          </div>
                          <small className="ann-author">Posted by {author}</small>
                        </div>
                      </div>
                      <h4>{a.title}</h4>
                      <p>{a.body}</p>
                      {a.documentName ? (
                        <button type="button" className="hr-ann-pdf-link" onClick={() => openAnnouncementPdf(a._id)}>
                          <PaperClipOutlined /> {a.documentName}
                        </button>
                      ) : null}
                      <div className="ann-card-foot">
                        <span>
                          {a.startDate && a.endDate
                            ? `${dayjs(a.startDate).format("DD MMM YYYY")} → ${dayjs(a.endDate).format("DD MMM YYYY")}`
                            : a.createdAt ? dayjs(a.createdAt).format("DD MMM YYYY · HH:mm") : ""}
                        </span>
                        <span className="ann-card-actions">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(a._id);
                              form.setFieldsValue({
                                title: a.title,
                                body: a.body,
                                audience: a.audience || "all",
                                startDate: a.startDate ? dayjs(a.startDate) : null,
                                endDate: a.endDate ? dayjs(a.endDate) : null,
                              });
                              setPdfFile(null);
                              setPdfName(a.documentName || "");
                            }}
                          >
                            <EditOutlined /> Edit
                          </button>
                          <button type="button" className="danger" onClick={() => onDelete(a)}>
                            <DeleteOutlined /> Delete
                          </button>
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </AdminPage>
  );
}
