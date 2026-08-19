import { createContext, useCallback, useContext, useEffect, useState } from "react";
import api from "../api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  const loadMe = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (token) {
      localStorage.setItem("flowhcm_token", token);
    }
    api.get("/auth/config")
      .then((cfg) => setGoogleEnabled(Boolean(cfg.data?.googleEnabled)))
      .catch(() => setGoogleEnabled(false));
    loadMe();
  }, [loadMe]);

  const demoLogin = useCallback(async (empId = "112") => {
    const { data } = await api.post("/auth/demo", { empId });
    localStorage.setItem("flowhcm_token", data.token);
    setUser(data.user);
  }, []);

  const adminLogin = useCallback(async (username, password) => {
    const { data } = await api.post("/auth/admin", { username, password });
    localStorage.setItem("flowhcm_token", data.token);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    await api.post("/auth/logout");
    localStorage.removeItem("flowhcm_token");
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, googleEnabled, demoLogin, adminLogin, logout, reload: loadMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
