import { useEffect, useState } from "react";
import { App as AntApp, Button, Card, Select, Space, Table, Tag, Typography } from "antd";
import api from "../api";

const STATUS = {
  pending: "gold",
  approved: "green",
  rejected: "red",
};

export default function AdminLeaves() {
  const { message } = AntApp.useApp();
  const [status, setStatus] = useState("pending");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState();

  async function load(nextStatus = status) {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/leaves", {
        params: nextStatus === "all" ? {} : { status: nextStatus },
      });
      setRows(data.requests);
    } catch (err) {
      message.error(err.response?.data?.message || "Could not load leaves");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(() => {});
  }, [status]);

  async function decide(id, next) {
    setActing(id);
    try {
      await api.patch(`/leaves/${id}`, { status: next });
      message.success(next === "approved" ? "Leave approved. Employee can now see Approved." : "Leave rejected");
      await load();
    } catch (err) {
      message.error(err.response?.data?.message || "Update failed");
    } finally {
      setActing(undefined);
    }
  }

  return (
    <div>
      <Typography.Title level={4}>Leave Approvals</Typography.Title>
      <Card>
        <Select
          value={status}
          onChange={setStatus}
          style={{ width: 180, marginBottom: 16 }}
          options={[
            { value: "pending", label: "Pending" },
            { value: "approved", label: "Approved" },
            { value: "rejected", label: "Rejected" },
            { value: "all", label: "All" },
          ]}
        />
        <Table
          rowKey="_id"
          loading={loading}
          dataSource={rows}
          pagination={{ pageSize: 10 }}
          columns={[
            { title: "Emp ID", dataIndex: "empId", width: 90 },
            { title: "Employee", dataIndex: "employeeName" },
            { title: "Type", dataIndex: "type", render: (v) => v?.[0]?.toUpperCase() + v?.slice(1) },
            { title: "From", dataIndex: "fromDate" },
            { title: "To", dataIndex: "toDate" },
            { title: "Days", dataIndex: "days" },
            { title: "Reason", dataIndex: "reason", ellipsis: true },
            {
              title: "Status",
              dataIndex: "status",
              render: (s) => <Tag color={STATUS[s] || "default"}>{s}</Tag>,
            },
            {
              title: "Action",
              render: (_, row) =>
                row.status === "pending" ? (
                  <Space>
                    <Button type="primary" size="small" loading={acting === row._id} onClick={() => decide(row._id, "approved")}>
                      Approve
                    </Button>
                    <Button danger size="small" loading={acting === row._id} onClick={() => decide(row._id, "rejected")}>
                      Reject
                    </Button>
                  </Space>
                ) : (
                  "-"
                ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
