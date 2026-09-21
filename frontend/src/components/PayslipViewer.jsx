import { useRef } from "react";
import { Button, Modal, Spin, message } from "antd";
import {
  FilePdfOutlined,
  MailOutlined,
  PrinterOutlined,
} from "@ant-design/icons";
import { useAuth } from "../context/AuthContext";

function fmt(n) {
  return Number(n || 0).toLocaleString("en-PK");
}

export default function PayslipViewer({ open, loading, payslip, onClose }) {
  const { user } = useAuth();
  const printRef = useRef(null);

  function handlePrint() {
    window.print();
  }

  function handlePdf() {
    message.info("Use Print → Save as PDF to download Softnox payslip");
    setTimeout(() => window.print(), 200);
  }

  function handleEmail() {
    message.success("Payslip email will be available in a later Softnox release");
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={980}
      destroyOnClose
      className="ps-modal"
      title={null}
      centered
    >
      {loading || !payslip ? (
        <div className="ps-boot"><Spin size="large" /></div>
      ) : (
        <div className="ps-shell">
          <header className="ps-toolbar no-print">
            <b>Softnox Technologies (Pvt) Ltd</b>
            <div className="ps-actions">
              <Button type="primary" icon={<PrinterOutlined />} onClick={handlePrint}>Print</Button>
              <Button type="primary" icon={<MailOutlined />} onClick={handleEmail}>Email</Button>
              <Button type="primary" icon={<FilePdfOutlined />} onClick={handlePdf}>PDF</Button>
            </div>
          </header>

          <div className="ps-doc" ref={printRef} id="softnox-payslip-print">
            <div className="ps-meta">
              <div>
                <div><span>Print Date</span> {payslip.printDate}</div>
                <div><span>Printed By</span> {user?.name || payslip.employee.name}</div>
                <div><span>Address</span> {payslip.address}</div>
              </div>
              <div className="ps-title-block">
                <h2>Payslip</h2>
                <p>Month Of {payslip.periodLabel}</p>
              </div>
            </div>

            <section className="ps-emp-grid">
              <div>
                <div><span>Employee Code</span><b>{payslip.employee.empId}</b></div>
                <div><span>Department</span><b>{payslip.employee.department}</b></div>
                <div><span>Cnic No</span><b>{payslip.employee.cnicNo}</b></div>
                <div><span>Employee Status</span><b>{payslip.employee.status}</b></div>
              </div>
              <div>
                <div><span>Employee Name</span><b>{payslip.employee.name}</b></div>
                <div><span>Sub Department</span><b>{payslip.employee.team}</b></div>
                <div><span>Joining Date</span><b>{payslip.employee.joiningDate}</b></div>
              </div>
              <div>
                <div><span>Station</span><b>{payslip.employee.station}</b></div>
                <div><span>Designation</span><b>{payslip.employee.jobTitle}</b></div>
                <div><span>Monthly Salary</span><b>{fmt(payslip.employee.monthlySalary)}</b></div>
              </div>
            </section>

            <section className="ps-main">
              <div className="ps-col">
                <header>
                  <span>Earning</span>
                  <span>Amount</span>
                </header>
                <ul>
                  {payslip.earnings.map((e) => (
                    <li key={e.label}><span>{e.label}</span><b>{fmt(e.amount)}</b></li>
                  ))}
                </ul>
                <footer>
                  <span>Total Earning</span>
                  <b>{fmt(payslip.totals.earning)}</b>
                </footer>
              </div>

              <div className="ps-col">
                <header>
                  <span>Deduction</span>
                  <span>Amount</span>
                </header>
                <ul>
                  {payslip.deductions.map((d) => (
                    <li key={d.label}><span>{d.label}</span><b>{fmt(d.amount)}</b></li>
                  ))}
                </ul>
                <footer>
                  <span>Total Deduction</span>
                  <b>{fmt(payslip.totals.deduction)}</b>
                </footer>
              </div>

              <div className="ps-side">
                <div className="ps-tax">
                  <span>Tax paid in this fiscal year</span>
                  <b>{fmt(payslip.totals.taxPaidFiscal)}</b>
                </div>
                <div className="ps-box">
                  <h4>Loan Balances</h4>
                  {(payslip.loanBalances || []).map((l) => (
                    <div key={l.label} className="ps-box-row">
                      <span>{l.label}</span>
                      <b>{fmt(l.amount)}</b>
                    </div>
                  ))}
                </div>
                <div className="ps-box">
                  <h4>Leave Balances</h4>
                  <div className="ps-box-row"><span>Causal Leaves</span><b>{Number(payslip.leaveBalances.casual).toFixed(2)}</b></div>
                  <div className="ps-box-row"><span>Annual Leaves</span><b>{Number(payslip.leaveBalances.annual).toFixed(2)}</b></div>
                  <div className="ps-box-row"><span>Sick Leave</span><b>{Number(payslip.leaveBalances.sick).toFixed(2)}</b></div>
                </div>
              </div>
            </section>

            <section className="ps-net">
              <div><span>Net Payment</span><b>PKR {fmt(payslip.totals.net)}/-</b></div>
              <div><span>Amount In Words</span><b>{payslip.totals.netWords}</b></div>
            </section>

            <p className="ps-foot">This is an automatically generated payslip and does not require any signature.</p>
          </div>
        </div>
      )}
    </Modal>
  );
}
