"use client";

import {
  CheckCircle2, XCircle, Loader2, AlertTriangle,
  Cpu, Database, BarChart2, DollarSign, Gavel, MessageSquare } from
"lucide-react";



const AGENT_ICONS = {
  detection: <Database size={14} />,
  risk: <AlertTriangle size={14} />,
  finance: <DollarSign size={14} />,
  decision: <Gavel size={14} />,
  action: <MessageSquare size={14} />,
  rule_check: <CheckCircle2 size={14} />
};



















function StatusIcon({ status }) {
  if (status === "completed") return <CheckCircle2 size={16} style={{ color: "var(--status-success)" }} />;
  if (status === "failed") return <XCircle size={16} style={{ color: "var(--status-danger)" }} />;
  if (status === "running") return <Loader2 size={16} className="animate-spin-slow" style={{ color: "var(--accent)" }} />;
  if (status === "skipped") return <div className="w-4 h-4 rounded-full" style={{ background: "var(--border-subtle)" }} />;
  return <div className="w-4 h-4 rounded-full" style={{ border: "2px solid var(--border-subtle)" }} />;
}

function durationMs(start, end) {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function PipelineNode({
  agentName,
  status,
  confidence,
  reasoningSummary,
  mcpToolCalls = [],
  startedAt,
  completedAt,
  isLast = false,
  label
}) {
  const icon = AGENT_ICONS[agentName] ?? <Cpu size={14} />;
  const duration = durationMs(startedAt, completedAt);
  const displayName = label ?? agentName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const isActive = status === "running";
  const isDone = status === "completed";
  const isFailed = status === "failed";

  const borderColor = isFailed ?
  "var(--status-danger-border)" :
  isActive ?
  "var(--accent-border)" :
  isDone ?
  "var(--status-success-border)" :
  "var(--border-subtle)";

  return (
    <div className="flex gap-4 relative">
      {/* Connector */}
      {!isLast &&
      <div
        className="absolute left-[19px] top-9 bottom-0 w-px"
        style={{
          background: isDone ? "var(--status-success)" : "var(--border-subtle)",
          opacity: isDone ? 0.4 : 1
        }} />

      }

      {/* Status icon */}
      <div className="pt-3 shrink-0 z-10">
        <StatusIcon status={status} />
      </div>

      {/* Card */}
      <div
        className="flex-1 rounded-md mb-3 overflow-hidden"
        style={{
          background: isActive ? "var(--bg-surface)" : "var(--bg-surface)",
          border: `1px solid ${borderColor}`,
          opacity: status === "pending" ? 0.5 : 1
        }}>
        
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-2.5"
          style={{ borderBottom: reasoningSummary || mcpToolCalls.length > 0 ? "1px solid var(--border-subtle)" : "none" }}>
          
          <div className="flex items-center gap-2">
            <span style={{ color: isActive ? "var(--accent)" : "var(--text-secondary)" }}>
              {icon}
            </span>
            <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {displayName}
            </span>
            {confidence != null &&
            <span
              className="text-xs font-mono tabular-nums px-1.5 py-0.5 rounded"
              style={{
                background: "var(--bg-surface-raised)",
                color: "var(--text-tertiary)",
                border: "1px solid var(--border-subtle)"
              }}>
              
                {Math.round(confidence * 100)}% conf
              </span>
            }
          </div>
          <div className="flex items-center gap-3">
            {duration &&
            <span className="text-[11px] font-mono" style={{ color: "var(--text-disabled)" }}>
                {duration}
              </span>
            }
            {isActive &&
            <span className="text-xs animate-pulse-glow" style={{ color: "var(--accent)" }}>
                Running…
              </span>
            }
          </div>
        </div>

        {/* Body */}
        {(reasoningSummary || mcpToolCalls.length > 0) &&
        <div className="px-4 py-3 space-y-2">
            {reasoningSummary &&
          <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                {reasoningSummary}
              </p>
          }
            {mcpToolCalls.length > 0 &&
          <div className="space-y-1 pt-1">
                {mcpToolCalls.map((call, i) =>
            <div
              key={i}
              className="flex items-center gap-2 text-xs font-mono"
              style={{ color: "var(--text-tertiary)" }}>
              
                    <span
                className="px-1.5 py-0.5 rounded text-[10px]"
                style={{
                  background: "var(--accent-muted)",
                  color: "var(--accent)",
                  border: "1px solid var(--accent-border)"
                }}>
                
                      MCP
                    </span>
                    <span>{call.server}</span>
                    <span style={{ color: "var(--border-default)" }}>→</span>
                    <span style={{ color: "var(--text-primary)" }}>{call.tool}</span>
                  </div>
            )}
              </div>
          }
          </div>
        }
      </div>
    </div>);

}