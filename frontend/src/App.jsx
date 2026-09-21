import { Navigate, Route, Routes } from "react-router-dom";
import { Spin } from "antd";
import { useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import MyInfo from "./pages/MyInfo";
import AdminAttendance from "./pages/AdminAttendance";
import AdminLeaves from "./pages/AdminLeaves";
import AdminDashboard from "./pages/AdminDashboard";
import AdminEmployees from "./pages/AdminEmployees";
import AdminEmployeeCreate from "./pages/AdminEmployeeCreate";
import AdminEmployeeProfile from "./pages/AdminEmployeeProfile";
import AdminEmployeeAttendance from "./pages/AdminEmployeeAttendance";
import AdminDepartments from "./pages/AdminDepartments";
import AdminShifts from "./pages/AdminShifts";
import AdminPayroll from "./pages/AdminPayroll";
import AdminRecruitment from "./pages/AdminRecruitment";
import AdminDocuments from "./pages/AdminDocuments";
import AdminReports from "./pages/AdminReports";
import AdminAnnouncements from "./pages/AdminAnnouncements";
import AdminSettings from "./pages/AdminSettings";
import AdminRoles from "./pages/AdminRoles";
import AdminAudit from "./pages/AdminAudit";
import AdminDevices from "./pages/AdminDevices";
import AuthCallback from "./pages/AuthCallback";

function Guard({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="boot">
        <Spin size="large" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AdminGuard({ children }) {
  const { user } = useAuth();
  if (!user?.isSuperAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}

function EmployeeGuard({ children }) {
  const { user } = useAuth();
  if (user?.isSuperAdmin) return <Navigate to="/admin/dashboard" replace />;
  return children;
}

function AdminRoute({ children }) {
  return <AdminGuard>{children}</AdminGuard>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route
        path="/"
        element={
          <Guard>
            <Layout />
          </Guard>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route
          path="dashboard"
          element={
            <EmployeeGuard>
              <Dashboard />
            </EmployeeGuard>
          }
        />
        <Route
          path="attendance"
          element={<Navigate to="/dashboard" replace />}
        />
        <Route
          path="info"
          element={
            <EmployeeGuard>
              <MyInfo />
            </EmployeeGuard>
          }
        />
        <Route path="leave" element={<Navigate to="/dashboard" replace />} />
        <Route
          path="admin"
          element={
            <AdminRoute>
              <Navigate to="/admin/dashboard" replace />
            </AdminRoute>
          }
        />
        <Route path="admin/dashboard" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        <Route path="admin/employees" element={<AdminRoute><AdminEmployees /></AdminRoute>} />
        <Route path="admin/employees/new" element={<AdminRoute><AdminEmployeeCreate /></AdminRoute>} />
        <Route path="admin/employees/:empId" element={<AdminRoute><AdminEmployeeProfile /></AdminRoute>} />
        <Route path="admin/attendance" element={<AdminRoute><AdminAttendance /></AdminRoute>} />
        <Route path="admin/attendance/:empId" element={<AdminRoute><AdminEmployeeAttendance /></AdminRoute>} />
        <Route path="admin/leaves" element={<AdminRoute><AdminLeaves /></AdminRoute>} />
        <Route path="admin/departments" element={<AdminRoute><AdminDepartments /></AdminRoute>} />
        <Route path="admin/shifts" element={<AdminRoute><AdminShifts /></AdminRoute>} />
        <Route path="admin/payroll" element={<AdminRoute><AdminPayroll /></AdminRoute>} />
        <Route path="admin/recruitment" element={<AdminRoute><AdminRecruitment /></AdminRoute>} />
        <Route path="admin/documents" element={<AdminRoute><AdminDocuments /></AdminRoute>} />
        <Route path="admin/reports" element={<AdminRoute><AdminReports /></AdminRoute>} />
        <Route path="admin/announcements" element={<AdminRoute><AdminAnnouncements /></AdminRoute>} />
        <Route path="admin/settings" element={<AdminRoute><AdminSettings /></AdminRoute>} />
        <Route path="admin/roles" element={<AdminRoute><AdminRoles /></AdminRoute>} />
        <Route path="admin/audit" element={<AdminRoute><AdminAudit /></AdminRoute>} />
        <Route path="admin/devices" element={<AdminRoute><AdminDevices /></AdminRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
