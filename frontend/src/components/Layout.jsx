import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Avatar, Layout as AntLayout, Menu } from "antd";
import {
  CalendarOutlined,
  CheckSquareOutlined,
  ClockCircleOutlined,
  DashboardOutlined,
  PoweroffOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useAuth } from "../context/AuthContext";

const { Header, Sider, Content, Footer } = AntLayout;

export default function Layout() {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const navigate = useNavigate();
  const initials = (user?.name || "U")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const employeeItems = [
    { type: "group", label: "OVERVIEW", children: [{ key: "/dashboard", icon: <DashboardOutlined />, label: "Dashboard" }] },
    { type: "group", label: "PERSONAL", children: [{ key: "/attendance", icon: <CalendarOutlined />, label: "My Attendance" }] },
  ];

  const adminItems = [
    { type: "group", label: "ADMIN", children: [
      { key: "/admin/attendance", icon: <ClockCircleOutlined />, label: "All Attendance" },
      { key: "/admin/leaves", icon: <CheckSquareOutlined />, label: "Leave Approvals" },
    ] },
  ];

  const pageLabel = loc.pathname.includes("attendance") && !loc.pathname.includes("admin")
    ? "My Attendance"
    : loc.pathname.includes("admin/leaves")
      ? "Leave Approvals"
      : loc.pathname.includes("admin")
        ? "All Attendance"
        : "Dashboard";

  return (
    <AntLayout className="softnox-shell">
      <Sider width={240} className="softnox-sider" breakpoint="lg" collapsedWidth={0}>
        <div className="sider-logo">
          <div className="logo-mark">S</div>
          <div>
            <b>softnox</b>
            <small>technologies Pvt Ltd</small>
          </div>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[loc.pathname]}
          items={user?.isSuperAdmin ? adminItems : employeeItems}
          onClick={({ key }) => navigate(key)}
        />
        <div className="sider-profile">
          <Avatar size={40} icon={<UserOutlined />}>{initials}</Avatar>
          <div>
            <div className="sider-name">{user?.name}</div>
            <div className="sider-role">{user?.isSuperAdmin ? "Super Admin" : `Emp ${user?.empId}`}</div>
          </div>
          <button type="button" className="signout-btn" onClick={logout} title="Sign out">
            <PoweroffOutlined /> Sign out
          </button>
        </div>
      </Sider>
      <AntLayout>
        <Header className="softnox-header">
          <span>{pageLabel} / Home</span>
          <span>Welcome, {user?.name}</span>
        </Header>
        <Content className="softnox-content">
          <Outlet />
        </Content>
        <Footer className="softnox-footer">© 2026 Softnox Technologies. All rights reserved.</Footer>
      </AntLayout>
    </AntLayout>
  );
}
