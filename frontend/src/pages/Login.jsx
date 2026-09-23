import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Alert, Button, Checkbox, Form, Input, Tabs } from "antd";
import {
  EyeInvisibleOutlined,
  EyeTwoTone,
  LockOutlined,
  MailOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { user, demoLogin, adminLogin, hrLogin } = useAuth();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState("employee");
  const qError = new URLSearchParams(window.location.search).get("error");

  if (user) {
    const home = user.isSuperAdmin ? "/admin/dashboard" : user.isHr ? "/hr/dashboard" : "/dashboard";
    return <Navigate to={home} replace />;
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

  async function onHr(values) {
    setBusy(true);
    setError("");
    try {
      await hrLogin(values.username, values.password);
    } catch (err) {
      setError(err.response?.data?.message || "HR login failed");
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
    <div className="auth-shell">
      <aside className="auth-hero">
        <div className="auth-hero-glow auth-hero-glow-a" />
        <div className="auth-hero-glow auth-hero-glow-b" />
        <div className="auth-hero-glow auth-hero-glow-c" />
        <div className="auth-hero-card auth-enter">
          <p className="auth-hero-kicker">Softnox Technologies</p>
          <h1>Human Resource Management (HRM) <br/ > Portal System</h1>
          <div className="auth-hero-visual" aria-hidden>
            <div className="auth-people">
              <span className="p1" />
              <span className="p2" />
              <span className="p3" />
            </div>
            <div className="auth-desk" />
          </div>
          <p className="auth-hero-sub">
            Efficiently manage your workforce, streamline attendance and operations effortlessly.
          </p>
        </div>
      </aside>

      <main className="auth-panel">
        <div className="auth-panel-inner auth-enter" style={{ animationDelay: "80ms" }}>
          <div className="auth-brand-row">
            <span className="auth-brand-mark">S</span>
            <b>Softnox Technologies</b>
          </div>

          <h2>Sign In</h2>
          <p className="auth-lead">Please enter your details to sign in</p>

          {(error || qError) && (
            <Alert
              type="error"
              showIcon
              className="auth-alert"
              message={error || "Google login failed"}
            />
          )}

          <Tabs
            activeKey={mode}
            onChange={setMode}
            className="auth-tabs"
            items={[
              {
                key: "employee",
                label: "Employee",
                children: (
                  <Form
                    layout="vertical"
                    onFinish={onEmployee}
                    initialValues={{ empId: "112", remember: true }}
                    className="auth-form"
                  >
                    <Form.Item
                      name="empId"
                      label="Employee Code"
                      rules={[{ required: true, message: "Apna emp code likhein" }]}
                    >
                      <Input
                        size="large"
                        placeholder="e.g. 112"
                        suffix={<UserOutlined className="auth-field-icon" />}
                      />
                    </Form.Item>
                    <div className="auth-row">
                      <Form.Item name="remember" valuePropName="checked" noStyle>
                        <Checkbox>Remember Me</Checkbox>
                      </Form.Item>
                      <button type="button" className="auth-link" tabIndex={-1}>
                        Forgot Password?
                      </button>
                    </div>
                    <Button block size="large" type="primary" htmlType="submit" loading={busy} className="auth-submit">
                      Sign In
                    </Button>
                  </Form>
                ),
              },
              {
                key: "hr",
                label: "HR",
                children: (
                  <Form layout="vertical" onFinish={onHr} initialValues={{ username: "hr", remember: true }} className="auth-form">
                    <Form.Item name="username" label="Username" rules={[{ required: true }]}>
                      <Input size="large" placeholder="hr" suffix={<MailOutlined className="auth-field-icon" />} />
                    </Form.Item>
                    <Form.Item name="password" label="Password" rules={[{ required: true }]}>
                      <Input.Password
                        size="large"
                        placeholder="Password"
                        iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
                        prefix={<LockOutlined className="auth-field-icon" />}
                      />
                    </Form.Item>
                    <Button block size="large" type="primary" htmlType="submit" loading={busy} className="auth-submit">
                      Sign In
                    </Button>
                  </Form>
                ),
              },
              {
                key: "admin",
                label: "Admin",
                children: (
                  <Form layout="vertical" onFinish={onAdmin} initialValues={{ remember: true }} className="auth-form">
                    <Form.Item name="username" label="Username" rules={[{ required: true }]}>
                      <Input
                        size="large"
                        placeholder="admin"
                        suffix={<MailOutlined className="auth-field-icon" />}
                      />
                    </Form.Item>
                    <Form.Item name="password" label="Password" rules={[{ required: true }]}>
                      <Input.Password
                        size="large"
                        placeholder="Password"
                        iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
                        prefix={<LockOutlined className="auth-field-icon" />}
                      />
                    </Form.Item>
                    <div className="auth-row">
                      <Form.Item name="remember" valuePropName="checked" noStyle>
                        <Checkbox>Remember Me</Checkbox>
                      </Form.Item>
                      <button type="button" className="auth-link" tabIndex={-1}>
                        Forgot Password?
                      </button>
                    </div>
                    <Button block size="large" type="primary" htmlType="submit" loading={busy} className="auth-submit">
                      Sign In
                    </Button>
                  </Form>
                ),
              },
            ]}
          />

          <p className="auth-switch">
            Need help signing in?{" "}
            <a href="mailto:hr@softnoxtechnologies.net">Contact HR</a>
          </p>

          <p className="auth-copy">Copyright © 2026 — Softnox Technologies</p>
        </div>
      </main>
    </div>
  );
}
