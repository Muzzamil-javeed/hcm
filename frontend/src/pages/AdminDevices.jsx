import { useEffect, useState } from "react";
import {
  App as AntApp,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Switch,
  Table,
  Spin,
} from "antd";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DesktopOutlined,
  EditOutlined,
  PlusOutlined,
  HddOutlined,
} from "@ant-design/icons";
import api from "../api";
import AdminPage from "../components/AdminPage";

export default function AdminDevices() {
  const { message } = AntApp.useApp();
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/devices");
      setRows(data.devices || []);
      setStats({
        total: data.total || 0,
        active: data.active || 0,
        inactive: data.inactive || 0,
      });
    } catch (err) {
      message.error(err.response?.data?.message || "Could not load devices");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(() => {});
  }, []);

  function openCreate() {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ port: 4370, active: true });
    setModalOpen(true);
  }

  function openEdit(row) {
    setEditing(row);
    form.setFieldsValue({
      name: row.name,
      deviceId: row.deviceId,
      ip: row.ip,
      port: row.port,
      active: row.active,
    });
    setModalOpen(true);
  }

  async function onSave(values) {
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/admin/devices/${editing.id}`, values);
        message.success("Device updated");
      } else {
        await api.post("/admin/devices", values);
        message.success("Device added");
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      message.error(err.response?.data?.message || "Could not save device");
    } finally {
      setSaving(false);
    }
  }

  async function onToggle(row) {
    try {
      await api.patch(`/admin/devices/${row.id}/toggle`);
      message.success(row.active ? "Device deactivated" : "Device activated");
      await load();
    } catch (err) {
      message.error(err.response?.data?.message || "Could not update status");
    }
  }

  if (loading && !rows.length) {
    return (
      <AdminPage title={<><DesktopOutlined /> Devices Management</>} subtitle="Loading…">
        <div className="boot"><Spin size="large" /></div>
      </AdminPage>
    );
  }

  return (
    <AdminPage
      title={<><DesktopOutlined /> Devices Management</>}
      subtitle="Manage attendance devices"
      extra={
        <Button type="primary" icon={<PlusOutlined />} className="dev-add-btn" onClick={openCreate}>
          Add Device
        </Button>
      }
    >
      <section className="dev-kpis">
        <article className="dev-kpi tone-blue dev-enter">
          <div>
            <span>Total devices</span>
            <strong>{stats.total}</strong>
          </div>
          <div className="dev-kpi-icon"><HddOutlined /></div>
        </article>
        <article className="dev-kpi tone-green dev-enter" style={{ animationDelay: "60ms" }}>
          <div>
            <span>Active devices</span>
            <strong>{stats.active}</strong>
          </div>
          <div className="dev-kpi-icon"><CheckCircleOutlined /></div>
        </article>
        <article className="dev-kpi tone-red dev-enter" style={{ animationDelay: "120ms" }}>
          <div>
            <span>Inactive devices</span>
            <strong>{stats.inactive}</strong>
          </div>
          <div className="dev-kpi-icon"><CloseCircleOutlined /></div>
        </article>
      </section>

      <section className="dev-panel dev-enter" style={{ animationDelay: "180ms" }}>
        <Table
          className="emp-table soft-card dev-table"
          rowKey="id"
          loading={loading}
          dataSource={rows}
          pagination={{ pageSize: 10, showTotal: (t) => `${t} devices` }}
          columns={[
            {
              title: "S.No",
              width: 70,
              render: (_v, _r, i) => <span className="dev-sno">{i + 1}</span>,
            },
            {
              title: "Device name",
              dataIndex: "name",
              render: (n, r) => (
                <div className="dev-name-cell">
                  <span className="dev-name-icon"><DesktopOutlined /></span>
                  <div>
                    <b>{n}</b>
                    <small>ID {r.deviceId}</small>
                  </div>
                </div>
              ),
            },
            { title: "Device IP", dataIndex: "ip", render: (v) => <code className="dev-mono">{v}</code> },
            { title: "Device port", dataIndex: "port", width: 120, render: (v) => <code className="dev-mono">{v}</code> },
            {
              title: "Status",
              dataIndex: "active",
              width: 140,
              render: (active, r) => (
                <button
                  type="button"
                  className={`dev-toggle ${active ? "on" : "off"}`}
                  onClick={() => onToggle(r)}
                  title={active ? "Deactivate" : "Activate"}
                >
                  <i />
                  <span>{active ? "Active" : "Inactive"}</span>
                </button>
              ),
            },
            {
              title: "Actions",
              width: 90,
              align: "center",
              render: (_v, r) => (
                <button type="button" className="dev-edit-btn" onClick={() => openEdit(r)} title="Edit device">
                  <EditOutlined />
                </button>
              ),
            },
          ]}
        />
      </section>

      <Modal
        title={editing ? "Edit device" : "Add device"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        destroyOnClose
        className="dev-modal"
      >
        <Form form={form} layout="vertical" onFinish={onSave} className="dev-form">
          <Form.Item name="name" label="Device name" rules={[{ required: true, message: "Name required" }]}>
            <Input placeholder="e.g. Machine 201" />
          </Form.Item>
          <Form.Item name="deviceId" label="Device ID" rules={[{ required: true, message: "Device ID required" }]}>
            <Input placeholder="e.g. 201" disabled={Boolean(editing)} />
          </Form.Item>
          <Form.Item name="ip" label="Device IP" rules={[{ required: true, message: "IP required" }]}>
            <Input placeholder="e.g. 192.168.0.12" />
          </Form.Item>
          <Form.Item name="port" label="Device port" rules={[{ required: true, message: "Port required" }]}>
            <InputNumber min={1} max={65535} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="active" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
          <div className="dev-form-actions">
            <Button onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={saving} className="dev-save-btn">
              {editing ? "Save changes" : "Add device"}
            </Button>
          </div>
        </Form>
      </Modal>
    </AdminPage>
  );
}
