"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import { Send, FileText, Loader2, Eye } from "lucide-react";
import Button from "@/components/ui/Button";

function SkeletonBlock({ h = 56 }) {
  return <div className="skeleton" style={{ height: h, borderRadius: 6 }} />;
}

const typeLabel = (type) =>
  type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const typePrefix = (type) => {
  if (type.includes("slack")) return "💬";
  if (type.includes("email")) return "✉️";
  return "📄";
};

export default function ActionsPage() {
  const [actions, setActions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(null);

  const load = useCallback(async (background = false) => {
    if (!background) setLoading(true);
    try {
      const data = await api.listActions();
      const list = data.actions ?? [];
      setActions(list);
      if (!selected && list.length > 0) setSelected(list[0]);
    } catch (e) { console.error(e); }
    finally { if (!background) setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSend = async (id) => {
    setSending(id);
    try { await api.sendAction(id); await load(true); }
    catch (e) { alert(e.message); }
    finally { setSending(null); }
  };

  return (
    <div className="split-layout" style={{ margin: "-28px -32px", minHeight: "calc(100vh - 56px)" }}>

      {/* Sidebar */}
      <div className="split-sidebar">
        <div
          className="flex-1 overflow-y-auto"
          style={{ borderTop: "1px solid var(--border-subtle)" }}
        >
          {loading ? (
            <div className="p-3 space-y-2">
              {[1, 2].map((i) => <SkeletonBlock key={i} />)}
            </div>
          ) : actions.length === 0 ? (
            <EmptyState
              compact
              icon={<FileText size={16} />}
              title="No actions yet"
              description="Approve a decision to generate a draft action."
            />
          ) : (
            actions.map((a) => {
              const isSelected = selected?.id === a.id;
              return (
                <Button
                  key={a.id}
                  onClick={() => setSelected(a)}
                  className="w-full text-left px-4 py-3.5 relative transition-colors"
                  style={{
                    background: isSelected ? "var(--bg-hover)" : "transparent",
                    borderBottom: "1px solid var(--border-subtle)",
                  }}
                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "var(--bg-surface-raised)"; }}
                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
                >
                  {isSelected && (
                    <span
                      style={{
                        position: "absolute",
                        left: 0, top: 6, bottom: 6,
                        width: 2,
                        borderRadius: "0 2px 2px 0",
                        background: "var(--accent)",
                      }}
                    />
                  )}
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className="text-sm font-medium"
                      style={{ color: isSelected ? "var(--accent)" : "var(--text-primary)" }}
                    >
                      {typePrefix(a.action_type)} {typeLabel(a.action_type)}
                    </span>
                    <StatusBadge status={a.status} />
                  </div>
                  <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                    {a.created_at ? new Date(a.created_at).toLocaleString() : ""}
                  </p>
                  {a.mcp_server_used && (
                    <p className="text-[10px] font-mono mt-1" style={{ color: "var(--text-disabled)" }}>
                      via {a.mcp_server_used}
                    </p>
                  )}
                </Button>
              );
            })
          )}
        </div>
      </div>

      {/* Detail panel */}
      <div className="split-main">
        {!selected ? (
          <div className="h-full flex items-center justify-center">
            <EmptyState
              icon={<Eye size={18} />}
              title="Select an action"
              description="Choose a draft from the queue to preview and send."
            />
          </div>
        ) : (
          <div className="p-7 w-full max-w-2xl mx-auto">

            <div className="flex items-center gap-3 mb-6">
              <h2
                style={{
                  fontSize: 20,
                  fontWeight: 600,
                  letterSpacing: "-0.025em",
                  color: "var(--text-primary)",
                }}
              >
                {typePrefix(selected.action_type)} {typeLabel(selected.action_type)}
              </h2>
              <StatusBadge status={selected.status} />
            </div>

            {/* Preview */}
            {selected.payload && (
              <div className="surface-card overflow-hidden mb-4">
                <div
                  className="flex items-center gap-2 px-5 py-3"
                  style={{ borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-surface-raised)" }}
                >
                  <Eye size={13} style={{ color: "var(--text-tertiary)" }} />
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)", letterSpacing: "0.06em" }}>
                    Draft Preview
                  </span>
                </div>
                <div className="p-5 space-y-5">
                  {selected.payload.subject && (
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wider mb-1.5" style={{ color: "var(--text-tertiary)" }}>Subject</p>
                      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{selected.payload.subject}</p>
                    </div>
                  )}
                  {selected.payload.body && (
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wider mb-1.5" style={{ color: "var(--text-tertiary)" }}>Body</p>
                      <div
                        className="text-sm leading-relaxed rounded-lg p-4 font-mono whitespace-pre-wrap"
                        style={{
                          background: "var(--bg-surface-raised)",
                          color: "var(--text-secondary)",
                          border: "1px solid var(--border-subtle)",
                          fontSize: 12,
                        }}
                      >
                        {selected.payload.body}
                      </div>
                    </div>
                  )}
                  {selected.payload.channel && (
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wider mb-1.5" style={{ color: "var(--text-tertiary)" }}>Channel</p>
                      <p className="text-sm font-mono font-medium" style={{ color: "var(--accent)" }}>{selected.payload.channel}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Metadata */}
            <div className="surface-card p-5 mb-4 grid grid-cols-2 gap-5">
              {[
                { label: "Status",     value: <StatusBadge status={selected.status} /> },
                { label: "MCP Server", value: selected.mcp_server_used ?? "—" },
                { label: "Sent At",    value: selected.executed_at ? new Date(selected.executed_at).toLocaleString() : "Not yet sent" },
                { label: "Created",    value: selected.created_at ? new Date(selected.created_at).toLocaleString() : "—" },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: "var(--text-tertiary)" }}>
                    {label}
                  </p>
                  <div className="text-sm" style={{ color: "var(--text-secondary)" }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Send action */}
            {selected.status === "draft" && (
              <div className="surface-card p-5">
                <h3
                  className="text-xs font-semibold uppercase tracking-wider mb-3"
                  style={{ color: "var(--text-secondary)", letterSpacing: "0.06em" }}
                >
                  Confirm Send
                </h3>
                <p className="text-sm mb-4" style={{ color: "var(--text-tertiary)" }}>
                  This action will be sent via the configured MCP server. Requires the linked decision to be approved.
                </p>
                <Button
                  onClick={() => handleSend(selected.id)}
                  disabled={!!sending}
                  className="btn btn-primary btn-lg"
                >
                  {sending === selected.id
                    ? <Loader2 size={14} className="animate-spin" />
                    : <Send size={14} />
                  }
                  {sending === selected.id ? "Sending…" : "Send Now"}
                </Button>
              </div>
            )}

            {selected.status === "sent" && (
              <div
                className="flex items-center gap-3 px-5 py-4 rounded-lg"
                style={{
                  background: "var(--status-success-muted)",
                  border: "1px solid var(--status-success-border)",
                }}
              >
                <Send size={16} style={{ color: "var(--status-success)", flexShrink: 0 }} />
                <p className="text-sm font-medium" style={{ color: "var(--status-success-text)" }}>
                  Sent via {selected.mcp_server_used ?? "MCP"}
                  {selected.executed_at && (
                    <span style={{ opacity: 0.7 }}> · {new Date(selected.executed_at).toLocaleString()}</span>
                  )}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}