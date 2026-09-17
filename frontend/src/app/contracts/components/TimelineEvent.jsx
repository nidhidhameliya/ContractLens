"use client";

import {
  CheckCircle2, XCircle, Clock, AlertCircle, Cpu, Settings,
  Zap, Shield, FileText,
} from "lucide-react";

const ACTION_META = {
  "contract.uploaded": {
    Icon: FileText,
    label: "Contract Uploaded",
    color: "var(--accent)",
    bg: "var(--accent-muted)",
  },
  "contract.scanned": {
    Icon: Cpu,
    label: "AI Scan Completed",
    color: "var(--status-success)",
    bg: "var(--status-success-muted)",
  },
  "decision.approved": {
    Icon: CheckCircle2,
    label: "Decision Approved",
    color: "var(--status-success)",
    bg: "var(--status-success-muted)",
  },
  "decision.rejected": {
    Icon: XCircle,
    label: "Decision Rejected",
    color: "var(--status-danger)",
    bg: "var(--status-danger-muted)",
  },
  "action.sent": {
    Icon: Zap,
    label: "Action Executed",
    color: "var(--accent)",
    bg: "var(--accent-muted)",
  },
  "mcp.connected": {
    Icon: Shield,
    label: "Integration Connected",
    color: "var(--status-success)",
    bg: "var(--status-success-muted)",
  },
  "mcp.disconnected": {
    Icon: Shield,
    label: "Integration Disconnected",
    color: "var(--status-warning)",
    bg: "var(--status-warning-muted)",
  },
  "settings.updated": {
    Icon: Settings,
    label: "Settings Updated",
    color: "var(--text-secondary)",
    bg: "var(--bg-surface-raised)",
  },
};

function relativeTime(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const min = Math.floor(diff / 60000);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (day > 0) return `${day}d ago`;
  if (hr > 0) return `${hr}h ago`;
  if (min > 0) return `${min}m ago`;
  return "just now";
}

export default function TimelineEvent({ action, entityType, userId, detail, timestamp, isLast = false }) {
  const meta = ACTION_META[action] ?? {
    Icon: AlertCircle,
    label: action.replace(/\./g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    color: "var(--text-tertiary)",
    bg: "var(--bg-surface-raised)",
  };

  const { Icon } = meta;

  return (
    <div className="flex gap-3 relative group">
      {/* Connector line */}
      {!isLast && (
        <div
          className="absolute top-8 bottom-0 w-px"
          style={{
            left: 15,
            background: "var(--border-subtle)",
          }}
        />
      )}

      {/* Icon bubble */}
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 z-10"
        style={{
          background: meta.bg,
          color: meta.color,
          border: "1px solid var(--border-subtle)",
        }}
      >
        <Icon size={13} />
      </div>

      {/* Content */}
      <div className="flex-1 pb-7 min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p
              className="text-sm font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              {meta.label}
            </p>

            {detail && (
              <p
                className="text-xs mt-1 leading-relaxed"
                style={{ color: "var(--text-secondary)" }}
              >
                {detail}
              </p>
            )}

            <div className="flex items-center gap-2 mt-1.5">
              <span
                className="text-[10px] font-medium uppercase tracking-wider"
                style={{ color: "var(--text-disabled)" }}
              >
                {userId ? "Human" : "AI System"}
              </span>
              {entityType && (
                <>
                  <span style={{ color: "var(--border-default)" }}>·</span>
                  <span
                    className="text-[10px] font-medium uppercase tracking-wider"
                    style={{ color: "var(--text-disabled)" }}
                  >
                    {entityType}
                  </span>
                </>
              )}
            </div>
          </div>

          <span
            className="text-xs tabular-nums shrink-0"
            style={{ color: "var(--text-tertiary)" }}
            title={new Date(timestamp).toLocaleString()}
          >
            {relativeTime(timestamp)}
          </span>
        </div>
      </div>
    </div>
  );
}