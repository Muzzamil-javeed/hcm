import { useEffect, useState } from "react";
import { Avatar, Modal, Spin, Tag } from "antd";
import {
  CalendarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
  PaperClipOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import api from "../api";

const STATUS_COLOR = {
  pending: "gold",
  hr_approved: "blue",
  approved: "success",
  rejected: "error",
};

const STATUS_LABEL = {
  pending: "With HR",
  hr_approved: "With Admin",
  approved: "Approved",
  rejected: "Rejected",
};

const TYPE_COLOR = {
  casual: "blue",
  annual: "purple",
  sick: "orange",
  unpaid: "default",
};

function titleCase(value = "") {
  return STATUS_LABEL[value] || (value ? value[0].toUpperCase() + value.slice(1) : "—");
}

function initials(name = "") {
  return name.split(" ").filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "?";
}

function hashColor(id) {
  const palette = ["#2563eb", "#db2777", "#0f766e", "#7c3aed", "#d97706", "#0891b2", "#16a34a", "#ea580c"];
  let hash = 0;
  for (const ch of String(id || "")) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length];
}

function prettyDate(value) {
  if (!value) return "—";
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("DD MMM YYYY") : String(value);
}

export default function LeaveDetailModal({
  row,
  onClose,
  canDecide = false,
  approveLabel = "Approve",
  acting,
  onDecide,
  onOpenProfile,
}) {
  const [doc, setDoc] = useState(null);
  const [docLoading, setDocLoading] = useState(false);

  useEffect(() => {
    if (!row?._id || !row.attachmentName) {
      setDoc(null);
      setDocLoading(false);
      return undefined;
    }
    let cancel = false;
    setDoc(null);
    setDocLoading(true);
    api.get(`/leaves/${row._id}`)
      .then(({ data }) => {
        if (cancel || !data?.attachmentData) return;
        setDoc({
          name: data.attachmentName || row.attachmentName,
          mime: data.attachmentMime || "",
          data: data.attachmentData,
        });
      })
      .catch(() => {
        if (!cancel) setDoc(null);
      })
      .finally(() => {
        if (!cancel) setDocLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [row]);

  const balanceLeft = row?.balances && row.type && row.type !== "unpaid"
    ? row.balances[row.type]
    : null;
  const isImage = doc?.mime?.startsWith("image/") || doc?.data?.startsWith("data:image/");

  return (
    <Modal
      open={Boolean(row)}
      onCancel={onClose}
      footer={null}
      width={640}
      destroyOnClose
      className="leave-detail-modal"
      title={row ? (
        <div className="att-modal-title">
          <Avatar size={48} style={{ background: hashColor(row.empId) }}>{initials(row.employeeName)}</Avatar>
          <div>
            <b>{row.employeeName}</b>
            <small>Emp {row.empId} · {row.jobTitle || "Employee"}</small>
          </div>
          <Tag color={STATUS_COLOR[row.status] || "default"}>{titleCase(row.status)}</Tag>
        </div>
      ) : null}
    >
      {row ? (
        <div className="leave-detail">
          <div className="emp-viz-tags">
            <Tag color={TYPE_COLOR[row.type] || "default"}>{titleCase(row.type)}</Tag>
            <Tag className="emp-tag dept">{row.department || "—"}</Tag>
            <Tag className="emp-tag team">{row.team || "—"}</Tag>
          </div>

          <div className="leave-detail-grid">
            <div>
              <span>Leave type</span>
              <b>{titleCase(row.type)}</b>
            </div>
            <div>
              <span>Duration</span>
              <b>{row.duration === "half" ? "Half day" : "Full day"}</b>
            </div>
            <div>
              <span>Days</span>
              <b>{row.days}</b>
            </div>
            <div>
              <span>From</span>
              <b>{prettyDate(row.fromDate)}</b>
            </div>
            <div>
              <span>To</span>
              <b>{prettyDate(row.toDate)}</b>
            </div>
            <div>
              <span>Applied on</span>
              <b>{row.createdAt ? dayjs(row.createdAt).format("DD MMM YYYY, hh:mm A") : "—"}</b>
            </div>
          </div>

          <p className="leave-detail-range">
            <CalendarOutlined /> {prettyDate(row.fromDate)} → {prettyDate(row.toDate)}
          </p>

          {balanceLeft != null ? (
            <p className="leave-detail-bal">
              {titleCase(row.type)} balance left: <b>{Number(balanceLeft).toFixed(1)}</b>
            </p>
          ) : null}

          <section className="leave-detail-block">
            <span><FileTextOutlined /> Description</span>
            <p>{row.reason?.trim() || "No description added."}</p>
          </section>

          <section className="leave-detail-block">
            <span><PaperClipOutlined /> Document</span>
            {docLoading ? <Spin size="small" /> : null}
            {!docLoading && isImage ? (
              <a href={doc.data} target="_blank" rel="noreferrer" className="leave-detail-preview">
                <img src={doc.data} alt={doc.name} />
                <em>{doc.name}</em>
              </a>
            ) : null}
            {!docLoading && doc && !isImage ? (
              <a className="leave-detail-file" href={doc.data} download={doc.name} target="_blank" rel="noreferrer">
                <PaperClipOutlined /> {doc.name}
              </a>
            ) : null}
            {!docLoading && !doc ? <p>No document attached.</p> : null}
          </section>

          {(row.email || row.mobile) ? (
            <p className="leave-detail-contact">
              {row.email || "No email"}{row.mobile ? ` · ${row.mobile}` : ""}
            </p>
          ) : null}

          <div className="leave-detail-actions">
            {onOpenProfile ? (
              <button type="button" className="emp-btn ghost" onClick={() => onOpenProfile(row.empId)}>
                Employee profile
              </button>
            ) : <span />}
            {canDecide ? (
              <div className="leave-card-actions">
                <button
                  type="button"
                  className="emp-btn primary"
                  disabled={acting === row._id}
                  onClick={() => onDecide?.(row._id, "approved")}
                >
                  <CheckCircleOutlined /> {approveLabel}
                </button>
                <button
                  type="button"
                  className="emp-btn ghost danger"
                  disabled={acting === row._id}
                  onClick={() => onDecide?.(row._id, "rejected")}
                >
                  <CloseCircleOutlined /> Reject
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
