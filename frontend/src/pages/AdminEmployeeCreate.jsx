import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  App as AntApp,
  AutoComplete,
  Button,
  Card,
  Col,
  DatePicker,
  Divider,
  Checkbox,
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
  CalendarOutlined,
  DeleteOutlined,
  FileTextOutlined,
  IdcardOutlined,
  LaptopOutlined,
  MailOutlined,
  PlusOutlined,
  SaveOutlined,
  UserAddOutlined,
  UserOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import AdminPage from "../components/AdminPage";

const PROGRESS_FIELDS = [
  "empId", "serialNo", "joiningDate", "name", "jobTitle", "department", "team", "role", "slot", "shift", "reportsTo",
  "gender", "dateOfBirth", "maritalStatus", "cnicNo", "religion",
  "casual", "annual", "sick",
];

function formProgress(values) {
  const checks = PROGRESS_FIELDS.map((key) => fieldFilled(values[key]));
  const emails = values.emails?.length ? values.emails : [{ value: "" }];
  const mobiles = values.mobiles?.length ? values.mobiles : [{ value: "" }];
  emails.forEach((row) => checks.push(fieldFilled(row?.value)));
  mobiles.forEach((row) => checks.push(fieldFilled(row?.value)));
  (values.documentItems || []).forEach((row) => checks.push(Boolean(row?.received) && fieldFilled(row?.name)));
  (values.extraFields || []).forEach((row) => checks.push(fieldFilled(row?.label) && fieldFilled(row?.value)));
  (values.assets || []).forEach((row) => checks.push(fieldFilled(row?.name)));
  const done = checks.filter(Boolean).length;
  return checks.length ? Math.round((done / checks.length) * 100) : 0;
}

function fieldFilled(value) {
  if (value == null || value === false || value === "") return false;
  if (typeof value === "number") return Number.isFinite(value);
  if (dayjs.isDayjs(value)) return value.isValid();
  if (typeof value === "string") return value.trim().length > 0;
  return Boolean(value);
}

function SectionTitle({ icon, tone, title, hint }) {
  return (
    <span className="emp-sec-title">
      <span className={`emp-sec-ico tone-${tone}`}>{icon}</span>
      <span>
        <b>{title}</b>
        {hint ? <small>{hint}</small> : null}
      </span>
    </span>
  );
}

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
  const { user } = useAuth();
  const base = user?.isHr ? "/hr" : "/admin";
  const { message } = AntApp.useApp();
  const [form] = Form.useForm();
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const watched = Form.useWatch([], form) || {};
  const progress = formProgress(watched);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/admin/employees/meta");
        setMeta(data);
        form.setFieldsValue({
          empId: data.nextEmpId,
          serialNo: data.nextSerial,
          role: undefined,
          jobTitle: "",
          department: undefined,
          team: undefined,
          slot: undefined,
          shift: "",
          joiningDate: dayjs(),
          gender: "",
          maritalStatus: "",
          religion: "",
          casual: 6,
          sick: 6,
          annual: 8,
          emails: [{ value: "" }],
          mobiles: [{ value: "" }],
          documentItems: [
            { name: "CNIC", received: false },
            { name: "Utility Bill", received: false },
            { name: "NDA signed", received: false },
          ],
          extraFields: [],
          assets: [],
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
        emails: (values.emails || []).filter((row) => row?.value),
        mobiles: (values.mobiles || []).filter((row) => row?.value),
        documentItems: (values.documentItems || []).filter((row) => row?.name),
        extraFields: (values.extraFields || []).filter((row) => row?.label),
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
      navigate(`${base}/employees/${data.employee.empId}`);
    } catch (err) {
      message.error(err.response?.data?.message || "Could not create employee");
    } finally {
      setSaving(false);
    }
  }

  if (user && !user.isHr) {
    return <Navigate to="/admin/employees" replace />;
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
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`${base}/employees`)}>
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
        <div className={`emp-progress${progress === 100 ? " is-done" : ""}`}>
          <div className="emp-progress-card">
          <div className="emp-progress-meta">
            <span className="emp-progress-label">
              <span className="emp-sec-ico tone-blue"><IdcardOutlined /></span>
              Profile progress
            </span>
            <b>{progress}% filled</b>
          </div>
          <div className="emp-progress-track" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <div className="emp-progress-bar" style={{ width: `${progress}%` }} />
          </div>
          {progress === 100 ? (
            <p className="emp-progress-done">Achha, saari info fill ho gayi. Ab employee create kar sakte ho.</p>
          ) : null}
          </div>
        </div>
        <Card className="soft-card emp-create-card" title={<SectionTitle tone="blue" icon={<IdcardOutlined />} title="Basic information" hint="Code, role, and team" />}>
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

        <Card className="soft-card emp-create-card" title={<SectionTitle tone="cyan" icon={<MailOutlined />} title="Contact" hint="Add as many emails and numbers as you need" />}>
          <Form.List name="emails">
            {(fields, { add, remove }) => (
              <div className="emp-dyn-block">
                {fields.map((field) => (
                  <div key={field.key} className="emp-dyn-row">
                    <Form.Item
                      {...field}
                      name={[field.name, "value"]}
                      label="Email"
                      rules={[{ type: "email", message: "Valid email" }]}
                    >
                      <Input placeholder="name@softnox.com" />
                    </Form.Item>
                    <Button type="text" danger icon={<DeleteOutlined />} aria-label="Remove email" onClick={() => remove(field.name)} />
                  </div>
                ))}
                <Button className="emp-add-btn" icon={<PlusOutlined />} onClick={() => add({ value: "" })}>
                  Add email
                </Button>
              </div>
            )}
          </Form.List>
          <Form.List name="mobiles">
            {(fields, { add, remove }) => (
              <div className="emp-dyn-block">
                {fields.map((field) => (
                  <div key={field.key} className="emp-dyn-row">
                    <Form.Item {...field} name={[field.name, "value"]} label="Mobile">
                      <Input placeholder="03XXXXXXXXX" />
                    </Form.Item>
                    <Button type="text" danger icon={<DeleteOutlined />} aria-label="Remove mobile" onClick={() => remove(field.name)} />
                  </div>
                ))}
                <Button className="emp-add-btn" icon={<PlusOutlined />} onClick={() => add({ value: "" })}>
                  Add mobile
                </Button>
              </div>
            )}
          </Form.List>
        </Card>

        <Card className="soft-card emp-create-card" title={<SectionTitle tone="purple" icon={<UserOutlined />} title="Personal information" hint="Private details for the file" />}>
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

        <Card className="soft-card emp-create-card" title={<SectionTitle tone="amber" icon={<FileTextOutlined />} title="Documents received" hint="Tick only what HR has in hand" />}>
          <Form.List name="documentItems">
            {(fields, { add, remove }) => (
              <div className="emp-dyn-block">
                {fields.map((field) => (
                  <div key={field.key} className="emp-dyn-row emp-dyn-doc">
                    <Form.Item {...field} name={[field.name, "name"]} label="Document">
                      <Input placeholder="Document name" />
                    </Form.Item>
                    <Form.Item {...field} name={[field.name, "received"]} valuePropName="checked" label=" ">
                      <Checkbox>Received</Checkbox>
                    </Form.Item>
                    <Button type="text" danger icon={<DeleteOutlined />} aria-label="Remove document" onClick={() => remove(field.name)} />
                  </div>
                ))}
                <Button className="emp-add-btn" icon={<PlusOutlined />} onClick={() => add({ name: "", received: false })}>
                  Add document
                </Button>
              </div>
            )}
          </Form.List>
        </Card>

        <Card className="soft-card emp-create-card" title={<SectionTitle tone="rose" icon={<PlusOutlined />} title="Extra information" hint="Any other detail, saved with the employee" />}>
          <Form.List name="extraFields">
            {(fields, { add, remove }) => (
              <div className="emp-dyn-block">
                {fields.map((field) => (
                  <div key={field.key} className="emp-dyn-row">
                    <Form.Item {...field} name={[field.name, "label"]} label="Field name">
                      <Input placeholder="e.g. Emergency contact" />
                    </Form.Item>
                    <Form.Item {...field} name={[field.name, "value"]} label="Value">
                      <Input placeholder="Value" />
                    </Form.Item>
                    <Button type="text" danger icon={<DeleteOutlined />} aria-label="Remove field" onClick={() => remove(field.name)} />
                  </div>
                ))}
                <Button className="emp-add-btn" icon={<PlusOutlined />} onClick={() => add({ label: "", value: "" })}>
                  Add field
                </Button>
              </div>
            )}
          </Form.List>
        </Card>

        <Card className="soft-card emp-create-card" title={<SectionTitle tone="green" icon={<CalendarOutlined />} title="Leave balances" hint="Opening balance for this year" />}>
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
          title={<SectionTitle tone="blue" icon={<LaptopOutlined />} title="Assets assigned" hint="Laptop, ID card, phone" />}
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
                <Button className="emp-add-btn" icon={<PlusOutlined />} onClick={() => add({ type: "other", categoryCode: "AST-001", assignedBy: "Softnox IT" })}>
                  Add asset
                </Button>
              </>
            )}
          </Form.List>
        </Card>

        <div className="emp-create-actions">
          <Space>
            <Button onClick={() => navigate(`${base}/employees`)}>Cancel</Button>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving} className="emp-create-save">
              Create Employee
            </Button>
          </Space>
        </div>
      </Form>
    </AdminPage>
  );
}
