import { Typography } from "antd";

export default function AdminPage({ title, subtitle, extra, children }) {
  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {title}
          </Typography.Title>
          {subtitle ? <p className="muted">{subtitle}</p> : null}
        </div>
        {extra ? <div className="admin-page-extra">{extra}</div> : null}
      </div>
      {children}
    </div>
  );
}
