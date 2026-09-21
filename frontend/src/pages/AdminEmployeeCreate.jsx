import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  App as AntApp,
  AutoComplete,
  Button,
  Card,
  Col,
  DatePicker,
  Divider,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Spin,
} from "antd";
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  PlusOutlined,
  SaveOutlined,
  UserAddOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import api from "../api";
import AdminPage from "../components/AdminPage";

const ASSET_TYPES = [
  { value: "laptop", label: "Laptop" },
  { value: "desktop", label: "Desktop" },
  { value: "monitor", label: "Monitor" },
  { value: "mouse", label: "Mouse" },
  { value: "keyboard", label: "Keyboard" },
  { value: "headset", label: "Headset" },
  { value: "phone", label: "Phone" },
  { value: "idcard", label: "ID / Access Card" },
  { value: "access", label: "Access Tag" },
  { value: "other", label: "Other" },
];

export default function AdminEmployeeCreate() {
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const [form] = Form.useForm();
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/admin/employees/meta");
        setMeta(data);
        form.setFieldsValue({
          empId: data.nextEmpId,
          serialNo: data.nextSerial,
          role: "Member",
          jobTitle: "Employee",
          department: data.departments?.[0] || "Operations",
          team: data.teams?.[0] || "General",
          slot: data.slots?.[0] || "General Shift",
          shift: data.slots?.[0] || "General Shift",
          joiningDate: dayjs(),
          gender: "",
          maritalStatus: "",
          religion: "",
          casual: 10,
          annual: 14,
          sick: 8,
          assets: [
            { type: "laptop", name: "Dell Latitude Laptop", categoryCode: "AST-001", assignedBy: "Softnox IT" },
            { type: "idcard", name: "Softnox Access Card", categoryCode: "ID-001", assignedBy: "Softnox IT" },
          ],
        });
      } catch (err) {
        message.error(err.response?.data?.message || "Could not load form defaults");
      } finally {
        setLoading(false);
      }
    })().catch(() => {});
  }, [form, message]);

  async function onFinish(values) {
    setSaving(true);
    try {
      const payload = {
        empId: String(values.empId).trim(),
        name: String(values.name).trim(),
        jobTitle: values.jobTitle,
        department: values.department,
        departmentFull: values.departmentFull || values.department,
        team: values.team,
        reportsTo: values.reportsTo || "-",
        role: values.role,
        shift: values.shift || values.slot,
        slot: values.slot || values.shift,
        maritalStatus: values.maritalStatus,
        gender: values.gender,
        dateOfBirth: values.dateOfBirth ? values.dateOfBirth.format("YYYY-MM-DD") : "",
        cnicNo: values.cnicNo,
        religion: values.religion,
        email: values.email,
        mobile: values.mobile,
        joiningDate: values.joiningDate ? values.joiningDate.format("YYYY-MM-DD") : "",
        serialNo: values.serialNo,
        balances: {
          casual: values.casual,
          annual: values.annual,
          sick: values.sick,
        },
        assets: (values.assets || [])
          .filter((a) => a?.name)
          .map((a) => ({
            name: a.name,
            type: a.type || "other",
            categoryCode: a.categoryCode || "AST-001",
            assetId: a.assetId || undefined,
            assignedBy: a.assignedBy || "Softnox IT",
            notes: a.notes || "",
            assignedAt: a.assignedAt ? a.assignedAt.toISOString() : undefined,
          })),
      };

      const { data } = await api.post("/admin/employees", payload);
      message.success(`Employee ${data.employee.empId} created`);
      navigate(`/admin/employees/${data.employee.empId}`);
    } catch (err) {
      message.error(err.response?.data?.message || "Could not create employee");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AdminPage title={<><UserAddOutlined /> Add Employee</>} subtitle="Loading…">
        <div className="boot" style={{ minHeight: 240 }}><Spin size="large" /></div>
      </AdminPage>
    );
  }

  const deptOptions = (meta?.departments || []).map((d) => ({ value: d, label: d }));
  const teamOptions = (meta?.teams || []).map((t) => ({ value: t, label: t }));
  const roleOptions = (meta?.roles?.length ? meta.roles : ["Head", "Manager", "Member"]).map((r) => ({ value: r, label: r }));
  const slotOptions = (meta?.slots || []).map((s) => ({ value: s, label: s }));
  const reportsOptions = (meta?.reportsTo || []).map((r) => ({ value: r, label: r }));

  return (
    <AdminPage
      title={<><UserAddOutlined /> Add New Employee</>}
      subtitle="Create Softnox employee with full profile, leave balances & assets"
      extra={
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/admin/employees")}>
          Back
        </Button>
      }
    >
      <Form
        form={form}
        layout="vertical"
        className="emp-create-form"
        onFinish={onFinish}
        requiredMark="optional"
      >
        <Card className="soft-card emp-create-card" title="Basic information">
          <Row gutter={[16, 0]}>
            <Col xs={24} md={8}>
              <Form.Item name="empId" label="Employee Code" rules={[{ required: true, message: "Emp code required" }]}>
                <Input placeholder="e.g. 520" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="serialNo" label="Serial No">
                <InputNumber className="w-full" min={1} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="joiningDate" label="Joining Date" rules={[{ required: true }]}>
                <DatePicker style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="name" label="Full Name" rules={[{ required: true, message: "Name required" }]}>
                <Input placeholder="Employee full name" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="jobTitle" label="Designation / Job Title" rules={[{ required: true }]}>
                <Input placeholder="e.g. Sales Executive" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="department" label="Department" rules={[{ required: true }]}>
                <AutoComplete options={deptOptions} placeholder="Select or type department" filterOption />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="departmentFull" label="Full Department Name">
                <Input placeholder="Optional full department label" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="team" label="Team" rules={[{ required: true }]}>
                <AutoComplete options={teamOptions} placeholder="Select or type team" filterOption />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="role" label="Role" rules={[{ required: true }]}>
                <Select options={roleOptions} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="slot" label="Shift / Slot">
                <AutoComplete options={slotOptions} placeholder="Shift slot" filterOption />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="shift" label="Shift Name">
                <Input placeholder="General Shift" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="reportsTo" label="Reports To">
                <AutoComplete options={reportsOptions} placeholder="Manager / Head" filterOption allowClear />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card className="soft-card emp-create-card" title="Contact">
          <Row gutter={[16, 0]}>
            <Col xs={24} md={12}>
              <Form.Item name="email" label="Email" rules={[{ type: "email", message: "Valid email" }]}>
                <Input placeholder="name@softnox.com" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="mobile" label="Mobile">
                <Input placeholder="03XXXXXXXXX" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card className="soft-card emp-create-card" title="Personal information">
          <Row gutter={[16, 0]}>
            <Col xs={24} md={8}>
              <Form.Item name="gender" label="Gender">
                <Select
                  allowClear
                  options={[
                    { value: "Male", label: "Male" },
                    { value: "Female", label: "Female" },
                    { value: "Other", label: "Other" },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="dateOfBirth" label="Date of Birth">
                <DatePicker style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="maritalStatus" label="Marital Status">
                <Select
                  allowClear
                  options={[
                    { value: "Single", label: "Single" },
                    { value: "Married", label: "Married" },
                    { value: "Other", label: "Other" },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="cnicNo" label="CNIC">
                <Input placeholder="XXXXX-XXXXXXX-X" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="religion" label="Religion">
                <Input placeholder="Optional" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card className="soft-card emp-create-card" title="Leave balances">
          <Row gutter={[16, 0]}>
            <Col xs={24} md={8}>
              <Form.Item name="casual" label="Casual Leave">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="annual" label="Annual Leave">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="sick" label="Sick Leave">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card
          className="soft-card emp-create-card"
          title="Assets assigned"
          extra={<span className="muted">Add laptop, ID card, phone, etc.</span>}
        >
          <Form.List name="assets">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field) => (
                  <div key={field.key} className="emp-asset-form-row">
                    <Row gutter={[12, 0]} align="middle">
                      <Col xs={24} md={5}>
                        <Form.Item {...field} name={[field.name, "type"]} label="Type" rules={[{ required: true }]}>
                          <Select options={ASSET_TYPES} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={7}>
                        <Form.Item {...field} name={[field.name, "name"]} label="Asset name" rules={[{ required: true }]}>
                          <Input placeholder="Dell Laptop" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={4}>
                        <Form.Item {...field} name={[field.name, "categoryCode"]} label="Code">
                          <Input placeholder="AST-001" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={4}>
                        <Form.Item {...field} name={[field.name, "assetId"]} label="Asset ID">
                          <Input placeholder="Auto if empty" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={3}>
                        <Form.Item {...field} name={[field.name, "assignedBy"]} label="Assigned by">
                          <Input placeholder="Softnox IT" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={1}>
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => remove(field.name)}
                          aria-label="Remove asset"
                          style={{ marginTop: 30 }}
                        />
                      </Col>
                    </Row>
                    <Form.Item {...field} name={[field.name, "notes"]} label="Notes" style={{ marginBottom: 8 }}>
                      <Input.TextArea rows={1} placeholder="Optional notes" />
                    </Form.Item>
                    <Divider style={{ margin: "8px 0 16px" }} />
                  </div>
                ))}
                <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({ type: "other", categoryCode: "AST-001", assignedBy: "Softnox IT" })}>
                  Add asset
                </Button>
              </>
            )}
          </Form.List>
        </Card>

        <div className="emp-create-actions">
          <Space>
            <Button onClick={() => navigate("/admin/employees")}>Cancel</Button>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving} className="emp-create-save">
              Create Employee
            </Button>
          </Space>
        </div>
      </Form>
    </AdminPage>
  );
}
