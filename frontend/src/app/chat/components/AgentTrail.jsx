"use client";

import {
  Search, AlertTriangle, DollarSign, Brain, Zap, Cpu, Wrench } from
"lucide-react";





















const agentIcons = {
  detection: Search,
  risk: AlertTriangle,
  finance: DollarSign,
  decision: Brain,
  action: Zap
};

const STATUS_STYLES = {
  completed: { color: "var(--status-success)", bg: "var(--status-success-muted)" },
  failed: { color: "var(--status-danger)", bg: "var(--status-danger-muted)" },
  low_confidence: { color: "var(--status-warning)", bg: "var(--status-warning-muted)" },
  running: { color: "var(--accent)", bg: "var(--accent-muted)" }
};

export default function AgentTrail({ agentRuns }) {
  if (!agentRuns || agentRuns.length === 0) {
    return (
      <div
        className="text-center py-12 text-sm"
        style={{ color: "var(--text-tertiary)" }}>
        
        <Cpu
          size={32}
          className="mx-auto mb-3"
          style={{ opacity: 0.3, color: "var(--text-disabled)" }} />
        
        No agent runs recorded for this contract yet.
      </div>);

  }

  return (
    <div className="relative">
      {/* Timeline connector line */}
      {agentRuns.length > 1 &&
      <div
        className="absolute left-[19px] top-6 bottom-6 w-px"
        style={{ background: "var(--border-subtle)" }} />

      }

      <div className="space-y-3">
        {agentRuns.map((run, idx) => {
          const IconComponent = agentIcons[run.agent_name] || Cpu;
          const confidence = run.confidence ? Math.round(run.confidence * 100) : null;
          const statusStyle = STATUS_STYLES[run.status] || {
            color: "var(--status-neutral)",
            bg: "var(--status-neutral-muted)"
          };
          const isRunning = run.status === "running";

          return (
            <div
              key={run.id}
              className="relative pl-12 animate-slide-up"
              style={{ animationDelay: `${idx * 80}ms` }}>
              
              {/* Timeline node */}
              <div
                className={`absolute left-1.5 top-4 w-7 h-7 rounded-md flex items-center justify-center z-10 ${
                isRunning ? "animate-shimmer" : ""}`
                }
                style={{
                  background: isRunning ? undefined : "var(--bg-surface-raised)",
                  border: `1px solid ${isRunning ? "var(--accent-border)" : "var(--border-subtle)"}`,
                  color: isRunning ? "var(--accent)" : "var(--text-tertiary)"
                }}>
                
                <IconComponent size={14} />
              </div>

              {/* Card */}
              <div
                className="rounded-md overflow-hidden"
                style={{
                  background: "var(--bg-surface)",
                  border: `1px solid ${isRunning ? "var(--accent-border)" : "var(--border-subtle)"}`
                }}>
                
                {/* Header */}
                <div
                  className="flex items-center gap-3 px-4 py-3"
                  style={{ borderBottom: `1px solid var(--border-subtle)` }}>
                  
                  <div className="flex-1">
                    <p
                      className="text-sm font-semibold capitalize"
                      style={{ color: "var(--text-primary)" }}>
                      
                      {run.agent_name} Agent
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                      {run.started_at ?
                      new Date(run.started_at).toLocaleTimeString() :
                      "--"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Confidence bar */}
                    {confidence !== null &&
                    <div className="flex items-center gap-1.5">
                        <div
                        className="w-16 h-1.5 rounded-full overflow-hidden"
                        style={{ background: "var(--bg-surface-raised)" }}>
                        
                          <div
                          className="h-full rounded-full animate-gauge-fill"
                          style={{
                            width: `${confidence}%`,
                            background: "var(--accent)"
                          }} />
                        
                        </div>
                        <span
                        className="text-xs font-mono tabular-nums"
                        style={{ color: "var(--text-tertiary)" }}>
                        
                          {confidence}%
                        </span>
                      </div>
                    }

                    {/* Status pill */}
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{
                        color: statusStyle.color,
                        background: statusStyle.bg
                      }}>
                      
                      {run.status}
                    </span>
                  </div>
                </div>

                {/* Reasoning */}
                {run.reasoning_summary &&
                <div
                  className="px-4 py-3"
                  style={{ borderBottom: `1px solid var(--border-subtle)` }}>
                  
                    <p
                    className="text-xs leading-relaxed"
                    style={{ color: "var(--text-secondary)" }}>
                    
                      {run.reasoning_summary}
                    </p>
                  </div>
                }

                {/* MCP tool calls */}
                {run.mcp_tool_calls && run.mcp_tool_calls.length > 0 &&
                <div className="px-4 py-3 space-y-1.5">
                    <p
                    className="text-[10px] font-semibold uppercase tracking-widest mb-2"
                    style={{ color: "var(--text-tertiary)" }}>
                    
                      MCP Tool Calls
                    </p>
                    {run.mcp_tool_calls.map((call, ci) =>
                  <div
                    key={ci}
                    className="flex items-center gap-2 rounded-md px-3 py-1.5"
                    style={{ background: "var(--bg-surface-raised)" }}>
                    
                        <Wrench
                      size={10}
                      style={{ color: "var(--text-disabled)", flexShrink: 0 }} />
                    
                        <span
                      className="text-[11px] font-mono px-1.5 py-0.5 rounded"
                      style={{
                        color: "var(--accent)",
                        background: "var(--accent-muted)"
                      }}>
                      
                          {call.tool}
                        </span>
                        <span
                      className="text-[11px] flex-1 truncate"
                      style={{ color: "var(--text-tertiary)" }}>
                      
                          {call.result_summary}
                        </span>
                        <span
                      className="text-[10px] font-mono"
                      style={{ color: "var(--text-disabled)" }}>
                      
                          {call.server}
                        </span>
                      </div>
                  )}
                  </div>
                }
              </div>
            </div>);

        })}
      </div>
    </div>);

}