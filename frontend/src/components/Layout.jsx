import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Avatar, Badge, Dropdown, Input, Layout as AntLayout, Menu, Select, message } from "antd";
import {
  AuditOutlined,
  BankOutlined,
  BarChartOutlined,
  BellOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
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
import api, { openAnnouncementPdf } from "../api";
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
  "/leave": "Apply Leave",
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
  "/hr/dashboard": "HR Dashboard",
  "/hr/employees": "Employees",
  "/hr/leaves": "Leave Approvals",
  "/hr/documents": "Documents",
  "/hr/attendance": "Attendance",
  "/hr/announcements": "Announcements",
};

export default function Layout() {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const navigate = useNavigate();
  const isAdmin = Boolean(user?.isSuperAdmin);
  const isHr = Boolean(user?.isHr);
  const isStaff = isAdmin || isHr;
  const [notifications, setNotifications] = useState([]);
  const [seenAt, setSeenAt] = useState(() => {
    try {
      return localStorage.getItem(`flowhcm_notif_seen_${user?.empId || "guest"}`) || "";
    } catch {
      return "";
    }
  });

  const initials = (user?.name || "U")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await api.get("/dashboard/notifications");
      setNotifications(data.notifications || []);
    } catch {
      /* ignore poll errors */
    }
  }, [user]);

  useEffect(() => {
    loadNotifications();
    const id = setInterval(loadNotifications, 45000);
    return () => clearInterval(id);
  }, [loadNotifications]);

  useEffect(() => {
    try {
      setSeenAt(localStorage.getItem(`flowhcm_notif_seen_${user?.empId || "guest"}`) || "");
    } catch {
      setSeenAt("");
    }
  }, [user?.empId]);

  const unreadCount = useMemo(() => {
    if (!notifications.length) return 0;
    if (!seenAt) return notifications.length;
    const seenMs = new Date(seenAt).getTime();
    return notifications.filter((n) => new Date(n.at).getTime() > seenMs).length;
  }, [notifications, seenAt]);

  function markNotificationsSeen() {
    const stamp = new Date().toISOString();
    setSeenAt(stamp);
    try {
      localStorage.setItem(`flowhcm_notif_seen_${user?.empId || "guest"}`, stamp);
    } catch {
      /* ignore */
    }
  }

  function formatNotifTime(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString(undefined, {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const employeeNotifPanel = (
    <div className="emp-note-panel">
      <header className="emp-note-head">
        <b>Notifications</b>
        {unreadCount > 0 && <em>{unreadCount} new</em>}
      </header>
      <ul className="emp-note-list">
        {!notifications.length && (
          <li className="emp-note-empty">No notifications yet</li>
        )}
        {notifications.map((n) => (
          <li key={n.id} className={`tone-${n.tone || "blue"}`}>
            <span className="emp-note-ico">
              {n.type === "leave_approved" ? (
                <CheckCircleOutlined />
              ) : n.type === "leave_rejected" ? (
                <CloseCircleOutlined />
              ) : n.type === "leave_request" || n.type === "leave_final" ? (
                <CalendarOutlined />
              ) : (
                <NotificationOutlined />
              )}
            </span>
            <div>
              <strong>{n.title}</strong>
              <p>{n.body}</p>
              {n.documentId ? (
                <button type="button" className="hr-ann-pdf-link" onClick={() => openAnnouncementPdf(n.documentId)}>
                  Open PDF
                </button>
              ) : null}
              <small>{formatNotifTime(n.at)}</small>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );

  const employeeItems = [
    { type: "group", label: "OVERVIEW", children: [{ key: "/dashboard", icon: <DashboardOutlined />, label: "Dashboard" }] },
    {
      type: "group",
      label: "PERSONAL",
      children: [
        { key: "/info", icon: <IdcardOutlined />, label: "My Info" },
        { key: "/leave", icon: <CalendarOutlined />, label: "Apply Leave" },
      ],
    },
  ];

  const hrItems = [
    { key: "/hr/dashboard", icon: <DashboardOutlined />, label: "HR Dashboard" },
    { key: "/hr/employees", icon: <TeamOutlined />, label: "Employees" },
    { key: "/hr/leaves", icon: <CalendarOutlined />, label: "Leave Approvals" },
    { key: "/hr/attendance", icon: <CheckCircleOutlined />, label: "Attendance" },
    { key: "/hr/documents", icon: <FileTextOutlined />, label: "Documents" },
    { key: "/hr/announcements", icon: <NotificationOutlined />, label: "Announcements" },
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
    if (loc.pathname === "/admin/employees/new" || loc.pathname === "/hr/employees/new") return "Add Employee";
    if (loc.pathname.startsWith("/admin/employees/") || loc.pathname.startsWith("/hr/employees/")) return "Employee Profile";
    if (loc.pathname.startsWith("/admin/attendance/") || loc.pathname.startsWith("/hr/attendance/")) return "Employee Attendance";
    return "Dashboard";
  })();

  const selectedMenuKey = (() => {
    if (loc.pathname.startsWith("/hr/employees")) return "/hr/employees";
    if (loc.pathname.startsWith("/hr/attendance")) return "/hr/attendance";
    if (loc.pathname.startsWith("/admin/employees")) return "/admin/employees";
    if (loc.pathname.startsWith("/admin/attendance")) return "/admin/attendance";
    return loc.pathname;
  })();

  const onMenuClick = ({ key }) => {
    if (READY_ADMIN_ROUTES.has(key) || key.startsWith("/hr/") || !isStaff) {
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
          <small>{isAdmin ? "Super Admin" : isHr ? "Human Resources" : `Emp ${user?.empId}`}</small>
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
        <small>{isAdmin ? "Super Admin" : isHr ? "Human Resources" : `Emp ${user?.empId}`}</small>
      </div>
      <DownOutlined className="admin-top-chevron" />
    </button>
  );

  return (
    <AntLayout className={`softnox-shell${isStaff ? " admin-shell" : ""}`}>
      <Sider width={248} className={isStaff ? "softnox-sider admin-sider" : "softnox-sider"} breakpoint="lg" collapsedWidth={0}>
        <div className="sider-logo">
          <div>
            <b>Softnox Technologies</b>
            <small>People. Progress. Together.</small>
          </div>
        </div>
        <Menu
          theme={isStaff ? "light" : "dark"}
          mode="inline"
          selectedKeys={[selectedMenuKey]}
          items={isHr ? hrItems : isAdmin ? adminItems : employeeItems}
          onClick={onMenuClick}
        />
      </Sider>
      <AntLayout>
        {isStaff ? (
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
                placement="bottomRight"
                onOpenChange={(open) => {
                  if (open) markNotificationsSeen();
                }}
                dropdownRender={() => employeeNotifPanel}
              >
                <button type="button" className={`admin-bell${unreadCount > 0 ? " has-unread" : ""}`} aria-label="Notifications">
                  <Badge count={unreadCount} size="small" className="admin-bell-badge" overflowCount={9}>
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
          <Header className="softnox-header emp-header">
            <span>{pageLabel} / Home</span>
            <div className="emp-topbar-right">
              <Dropdown
                trigger={["click"]}
                placement="bottomRight"
                onOpenChange={(open) => {
                  if (open) markNotificationsSeen();
                }}
                dropdownRender={() => employeeNotifPanel}
              >
                <button
                  type="button"
                  className={`admin-bell${unreadCount > 0 ? " has-unread" : ""}`}
                  aria-label="Notifications"
                >
                  <Badge count={unreadCount} size="small" className="admin-bell-badge" overflowCount={9}>
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
        )}
        <Content className="softnox-content">
          <Outlet />
        </Content>
        <Footer className="softnox-footer">© 2026 Softnox Technologies. All rights reserved.</Footer>
      </AntLayout>
    </AntLayout>
  );
}
