import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AuthCallback() {
  const { reload } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (token) localStorage.setItem("flowhcm_token", token);
    let cancelled = false;
    reload().then(() => {
      if (!cancelled) navigate("/dashboard", { replace: true });
    });
    return () => {
      cancelled = true;
    };
  }, [reload, navigate]);

  return <div className="boot">Signing you in...</div>;
}
