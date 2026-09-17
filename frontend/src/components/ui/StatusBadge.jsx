"use client";

const VARIANT_STYLES = {
  active:        { variant: "success",  label: "Active" },
  connected:     { variant: "success",  label: "Connected" },
  approved:      { variant: "success",  label: "Approved" },
  auto_approved: { variant: "success",  label: "Auto Approved" },
  sent:          { variant: "success",  label: "Sent" },

  scanning:      { variant: "accent",   label: "Scanning", pulse: true },
  pending:       { variant: "warning",  label: "Pending" },
  draft:         { variant: "warning",  label: "Draft" },
  manual_review: { variant: "warning",  label: "Manual Review" },

  rejected:      { variant: "danger",   label: "Rejected" },
  parse_failed:  { variant: "danger",   label: "Parse Failed" },
  expired:       { variant: "danger",   label: "Expired" },

  archived:      { variant: "neutral",  label: "Archived" },
  cancelled:     { variant: "neutral",  label: "Cancelled" },
  disconnected:  { variant: "neutral",  label: "Disconnected" },
};

const VARIANT_CLASS = {
  success: "badge-success",
  warning: "badge-warning",
  danger:  "badge-danger",
  neutral: "badge-neutral",
  accent:  "badge-accent",
};

function labelFor(status) {
  const meta = VARIANT_STYLES[status];
  if (meta?.label) return meta.label;
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function StatusBadge({ status, label, showDot = true, size = "sm" }) {
  const meta = VARIANT_STYLES[status] ?? { variant: "neutral" };
  const badgeClass = VARIANT_CLASS[meta.variant] ?? "badge-neutral";
  const sizeClass = size === "sm" ? "" : "text-xs px-2.5 py-1";

  return (
    <span className={`badge ${badgeClass} ${sizeClass}`}>
      {showDot && (
        <span
          className={`inline-block shrink-0 rounded-full ${meta.pulse ? "animate-pulse-dot" : ""}`}
          style={{ width: 5, height: 5, background: "currentColor", opacity: 0.7 }}
        />
      )}
      {label ?? labelFor(status)}
    </span>
  );
}