import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Alert, Button, Card, Form, Input, Tabs, Typography } from "antd";
import { GoogleOutlined, LockOutlined, UserOutlined } from "@ant-design/icons";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { user, demoLogin, adminLogin } = useAuth();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const qError = new URLSearchParams(window.location.search).get("error");

  if (user) {
    return <Navigate to={user.isSuperAdmin ? "/admin/attendance" : "/dashboard"} replace />;
  }

  async function onEmployee(values) {
    setBusy(true);
    setError("");
    try {
      await demoLogin(String(values.empId).trim());
    } catch (err) {
      setError(err.response?.data?.message || "Employee login failed");
    } finally {
      setBusy(false);
    }
  }

  async function onAdmin(values) {
    setBusy(true);
    setError("");
    try {
      await adminLogin(values.username, values.password);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          (err.code === "ERR_NETWORK" ? "Server band hai. Dobara try karein." : "Admin login failed")
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <Card className="login-card">
        <Typography.Title level={2} style={{ marginBottom: 4, color: "#4a5235" }}>
          softnox <span style={{ fontWeight: 500 }}>technologies</span>
        </Typography.Title>
        <Typography.Paragraph type="secondary">Employee self service and admin portal</Typography.Paragraph>
        {(error || qError) && (
          <Alert type="error" showIcon style={{ marginBottom: 16, textAlign: "left" }} message={error || "Google login failed"} />
        )}
        <Tabs
          centered
          items={[
            {
              key: "employee",
              label: "Employee",
              children: (
                <Form layout="vertical" onFinish={onEmployee} style={{ textAlign: "left" }} initialValues={{ empId: "240" }}>
                  <Form.Item
                    name="empId"
                    label="Employee Code"
                    rules={[{ required: true, message: "Apna emp code likhein, e.g. 240" }]}
                  >
                    <Input prefix={<UserOutlined />} placeholder="240" size="large" />
                  </Form.Item>
                  <Button block size="large" type="primary" htmlType="submit" loading={busy}>
                    Open My Dashboard
                  </Button>
                  <Button block size="large" icon={<GoogleOutlined />} href="/api/auth/google" style={{ marginTop: 10 }}>
                    Login with Google
                  </Button>
                </Form>
              ),
            },
            {
              key: "admin",
              label: "Admin Portal",
              children: (
                <Form layout="vertical" onFinish={onAdmin} style={{ textAlign: "left" }}>
                  <Form.Item name="username" label="Username" rules={[{ required: true }]}>
                    <Input prefix={<UserOutlined />} placeholder="admin" size="large" />
                  </Form.Item>
                  <Form.Item name="password" label="Password" rules={[{ required: true }]}>
                    <Input.Password prefix={<LockOutlined />} placeholder="Password" size="large" />
                  </Form.Item>
                  <Button block size="large" type="primary" htmlType="submit" loading={busy}>
                    Login as Super Admin
                  </Button>
                </Form>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
