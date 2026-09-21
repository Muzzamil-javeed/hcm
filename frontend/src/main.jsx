import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ConfigProvider, App as AntApp } from "antd";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#2563eb",
          colorBgLayout: "#f1f5f9",
          colorText: "#0f172a",
          colorTextSecondary: "#64748b",
          colorBorder: "#e2e8f0",
          colorBgContainer: "#ffffff",
          borderRadius: 8,
          fontFamily: `"Plus Jakarta Sans", system-ui, sans-serif`,
        },
        components: {
          Layout: {
            headerBg: "#ffffff",
            bodyBg: "#f1f5f9",
            siderBg: "#0f172a",
          },
          Menu: {
            darkItemBg: "#0f172a",
            darkItemSelectedBg: "#2563eb",
            darkItemHoverBg: "rgba(255,255,255,0.06)",
          },
          Table: {
            headerBg: "#f8fafc",
            headerColor: "#334155",
            borderColor: "#e2e8f0",
          },
          Card: {
            colorBgContainer: "#ffffff",
          },
        },
      }}
    >
      <BrowserRouter>
        <AuthProvider>
          <AntApp>
            <App />
          </AntApp>
        </AuthProvider>
      </BrowserRouter>
    </ConfigProvider>
  </React.StrictMode>
);
