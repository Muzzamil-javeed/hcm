import { Navigate, Route, Routes } from "react-router-dom";
import { Spin } from "antd";
import { useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import MyAttendance from "./pages/MyAttendance";
import AdminAttendance from "./pages/AdminAttendance";
import AdminLeaves from "./pages/AdminLeaves";
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
  if (user?.isSuperAdmin) return <Navigate to="/admin/attendance" replace />;
  return children;
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
          element={
            <EmployeeGuard>
              <MyAttendance />
            </EmployeeGuard>
          }
        />
        <Route path="leave" element={<Navigate to="/attendance" replace />} />
        <Route
          path="admin/attendance"
          element={
            <AdminGuard>
              <AdminAttendance />
            </AdminGuard>
          }
        />
        <Route
          path="admin/leaves"
          element={
            <AdminGuard>
              <AdminLeaves />
            </AdminGuard>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
