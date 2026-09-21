import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Avatar, Badge, Dropdown, Input, Layout as AntLayout, Menu, Select, message } from "antd";
import {
  AuditOutlined,
  BankOutlined,
  BarChartOutlined,
  BellOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  DashboardOutlined,
  DesktopOutlined,
  DollarOutlined,
  DownOutlined,
  FileTextOutlined,
  IdcardOutlined,
  LogoutOutlined,
  NotificationOutlined,
  SafetyCertificateOutlined,
  ScheduleOutlined,
  SearchOutlined,
  SettingOutlined,
  TeamOutlined,
  UserAddOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useAuth } from "../context/AuthContext";

const { Header, Sider, Content, Footer } = AntLayout;

const READY_ADMIN_ROUTES = new Set([
  "/admin/dashboard",
  "/admin/employees",
  "/admin/attendance",
  "/admin/leaves",
  "/admin/payroll",
  "/admin/recruitment",
  "/admin/departments",
  "/admin/shifts",
  "/admin/documents",
  "/admin/reports",
  "/admin/announcements",
  "/admin/settings",
  "/admin/roles",
  "/admin/audit",
  "/admin/devices",
]);

const PAGE_TITLES = {
  "/dashboard": "Dashboard",
  "/info": "My Info",
  "/admin/dashboard": "Dashboard",
  "/admin/employees": "Employees",
  "/admin/attendance": "Attendance",
  "/admin/leaves": "Leave Management",
  "/admin/payroll": "Payroll",
  "/admin/recruitment": "Recruitment",
  "/admin/departments": "Departments",
  "/admin/shifts": "Shifts & Scheduling",
  "/admin/documents": "Documents",
  "/admin/reports": "Reports & Analytics",
  "/admin/announcements": "Announcements",
  "/admin/settings": "Settings",
  "/admin/roles": "Roles & Permissions",
  "/admin/audit": "Audit Logs",
  "/admin/devices": "Devices",
};

export default function Layout() {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const navigate = useNavigate();
  const isAdmin = Boolean(user?.isSuperAdmin);
  const initials = (user?.name || "U")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const employeeItems = [
    { type: "group", label: "OVERVIEW", children: [{ key: "/dashboard", icon: <DashboardOutlined />, label: "Dashboard" }] },
    {
      type: "group",
      label: "PERSONAL",
      children: [
        { key: "/info", icon: <IdcardOutlined />, label: "My Info" },
      ],
    },
  ];

  const adminItems = [
    { key: "/admin/dashboard", icon: <DashboardOutlined />, label: "Dashboard" },
    { key: "/admin/employees", icon: <TeamOutlined />, label: "Employees" },
    { key: "/admin/attendance", icon: <CheckCircleOutlined />, label: "Attendance" },
    { key: "/admin/devices", icon: <DesktopOutlined />, label: "Devices" },
    { key: "/admin/departments", icon: <BankOutlined />, label: "Departments" },
    { key: "/admin/shifts", icon: <ScheduleOutlined />, label: "Shifts & Scheduling" },
    { key: "/admin/documents", icon: <FileTextOutlined />, label: "Documents" },
    { key: "/admin/leaves", icon: <CalendarOutlined />, label: "Leave Management" },
    { key: "/admin/payroll", icon: <DollarOutlined />, label: "Payroll" },
    { key: "/admin/recruitment", icon: <UserAddOutlined />, label: "Recruitment" },
    { key: "/admin/reports", icon: <BarChartOutlined />, label: "Reports & Analytics" },
    { key: "/admin/announcements", icon: <NotificationOutlined />, label: "Announcements" },
    { type: "group", label: "ADMIN", children: [
      { key: "/admin/settings", icon: <SettingOutlined />, label: "Settings" },
      { key: "/admin/roles", icon: <SafetyCertificateOutlined />, label: "Roles & Permissions" },
      { key: "/admin/audit", icon: <AuditOutlined />, label: "Audit Logs" },
    ] },
  ];

  const pageLabel = (() => {
    if (PAGE_TITLES[loc.pathname]) return PAGE_TITLES[loc.pathname];
    if (loc.pathname === "/admin/employees/new") return "Add Employee";
    if (loc.pathname.startsWith("/admin/employees/")) return "Employee Profile";
    if (loc.pathname.startsWith("/admin/attendance/")) return "Employee Attendance";
    return "Dashboard";
  })();

  const selectedMenuKey = (() => {
    if (loc.pathname.startsWith("/admin/employees")) return "/admin/employees";
    if (loc.pathname.startsWith("/admin/attendance")) return "/admin/attendance";
    return loc.pathname;
  })();

  const onMenuClick = ({ key }) => {
    if (READY_ADMIN_ROUTES.has(key) || !isAdmin) {
      navigate(key);
      return;
    }
    message.info(`${PAGE_TITLES[key] || "This"} page will be added next — menu only for now.`);
  };

  const profileMenu = {
    items: [
      {
        key: "logout",
        danger: true,
        icon: <LogoutOutlined />,
        label: "Logout",
      },
    ],
    onClick: ({ key }) => {
      if (key === "logout") logout();
    },
  };

  const profileDropdown = (menu) => (
    <div className="profile-drop-panel">
      <div className="profile-drop-head">
        <Avatar size={40} style={{ background: "#2563eb" }}>{initials}</Avatar>
        <div>
          <b>{user?.name || "User"}</b>
          <small>{isAdmin ? "Super Admin" : `Emp ${user?.empId}`}</small>
        </div>
      </div>
      <div className="profile-drop-divider" />
      {menu}
    </div>
  );

  const profileTrigger = (
    <button type="button" className="admin-top-user" aria-label="Account menu">
      <Avatar size={36} style={{ background: "#2563eb" }}>{initials}</Avatar>
      <div className="admin-top-user-copy">
        <b>{user?.name || "Admin"}</b>
        <small>{isAdmin ? "Super Admin" : `Emp ${user?.empId}`}</small>
      </div>
      <DownOutlined className="admin-top-chevron" />
    </button>
  );

  return (
    <AntLayout className={`softnox-shell${isAdmin ? " admin-shell" : ""}`}>
      <Sider width={248} className={isAdmin ? "softnox-sider admin-sider" : "softnox-sider"} breakpoint="lg" collapsedWidth={0}>
        <div className="sider-logo">
          <div>
            <b>Softnox Technologies</b>
            <small>People. Progress. Together.</small>
          </div>
        </div>
        <Menu
          theme={isAdmin ? "light" : "dark"}
          mode="inline"
          selectedKeys={[selectedMenuKey]}
          items={isAdmin ? adminItems : employeeItems}
          onClick={onMenuClick}
        />
      </Sider>
      <AntLayout>
        {isAdmin ? (
          <Header className="softnox-header admin-header">
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Search employees, departments, etc..."
              className="admin-search"
            />
            <div className="admin-topbar-right">
              <Select
                defaultValue="softnox"
                className="admin-org"
                options={[{ value: "softnox", label: "Softnox Technologies" }]}
              />
              <Dropdown
                trigger={["click"]}
                dropdownRender={() => (
                  <div className="admin-note-panel">
                    <b>Notifications</b>
                    <p>7 leave requests need review</p>
                    <p>5 attendance corrections pending</p>
                    <p>3 documents expire this week</p>
                  </div>
                )}
              >
                <button type="button" className="admin-bell has-unread" aria-label="Notifications">
                  <Badge count={3} size="small" className="admin-bell-badge">
                    <BellOutlined className="admin-bell-icon" />
                  </Badge>
                </button>
              </Dropdown>
              <Dropdown
                menu={profileMenu}
                trigger={["click"]}
                placement="bottomRight"
                overlayClassName="profile-drop"
                dropdownRender={profileDropdown}
              >
                {profileTrigger}
              </Dropdown>
            </div>
          </Header>
        ) : (
          <Header className="softnox-header">
            <span>{pageLabel} / Home</span>
            <Dropdown
              menu={profileMenu}
              trigger={["click"]}
              placement="bottomRight"
              overlayClassName="profile-drop"
              dropdownRender={profileDropdown}
            >
              {profileTrigger}
            </Dropdown>
          </Header>
        )}
        <Content className="softnox-content">
          <Outlet />
        </Content>
        <Footer className="softnox-footer">© 2026 Softnox Technologies. All rights reserved.</Footer>
      </AntLayout>
    </AntLayout>
  );
}
