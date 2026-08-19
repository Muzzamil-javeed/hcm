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
          colorPrimary: "#5f6744",
          colorBgLayout: "#f6f3e8",
          borderRadius: 10,
          fontFamily: `"Source Sans 3", "Segoe UI", sans-serif`,
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
