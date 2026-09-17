"use client";

import { CheckCircle2, XCircle, MinusCircle, AlertTriangle } from "lucide-react";










export default function PolicyRuleRow({
  label,
  description,
  evaluated,
  threshold,
  passed,
  isAI = false
}) {
  const icon =
  passed === null ?
  <MinusCircle size={15} style={{ color: "var(--text-disabled)" }} /> :
  passed ?
  <CheckCircle2 size={15} style={{ color: "var(--status-success)" }} /> :

  <XCircle size={15} style={{ color: "var(--status-danger)" }} />;


  const resultColor =
  passed === null ?
  "var(--text-disabled)" :
  passed ?
  "var(--status-success)" :
  "var(--status-danger)";

  return (
    <div
      className="flex items-start gap-3 py-3"
      style={{ borderBottom: "1px solid var(--border-subtle)" }}>
      
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-sm font-medium"
            style={{ color: "var(--text-primary)" }}>
            
            {label}
          </span>
          {!isAI &&
          <span
            className="text-[10px] font-mono px-1.5 py-0.5 rounded"
            style={{
              background: "var(--bg-surface-raised)",
              color: "var(--text-disabled)",
              border: "1px solid var(--border-subtle)"
            }}>
            
              POLICY RULE
            </span>
          }
        </div>
        {description &&
        <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
            {description}
          </p>
        }
        {(evaluated != null || threshold != null) &&
        <div className="flex items-center gap-3 mt-1 text-xs font-mono">
            {evaluated != null &&
          <span style={{ color: "var(--text-secondary)" }}>
                Value: <span style={{ color: "var(--text-primary)" }}>{evaluated}</span>
              </span>
          }
            {threshold != null &&
          <span style={{ color: "var(--text-secondary)" }}>
                Threshold: <span style={{ color: "var(--text-primary)" }}>{threshold}</span>
              </span>
          }
          </div>
        }
      </div>
      <span
        className="text-xs font-medium shrink-0 mt-0.5"
        style={{ color: resultColor }}>
        
        {passed === null ? "N/A" : passed ? "PASS" : "TRIGGERED"}
      </span>
    </div>);

}