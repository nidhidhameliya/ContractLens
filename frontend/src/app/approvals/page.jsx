"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import RiskBadge from "@/components/ui/RiskBadge";
import StatusBadge from "@/components/ui/StatusBadge";
import RiskMeter from "@/components/ui/RiskMeter";
import PolicyRuleRow from "@/app/contracts/components/PolicyRuleRow";
import CurrencyValue from "@/components/ui/CurrencyValue";
import EmptyState from "@/components/ui/EmptyState";
import Link from "next/link";
import Button from "@/components/ui/Button";
import {
  Bell, CheckCircle2, XCircle, FileText, Users,
  AlertTriangle, Cpu, Zap, Clock,
} from "lucide-react";

function SkeletonBlock({ h = 80 }) {
  return <div className="skeleton" style={{ height: h, borderRadius: 6 }} />;
}

export default function ApprovalsPage() {
  const [decisions, setDecisions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [filterTab, setFilterTab] = useState("pending");
  const [orgSettings, setOrgSettings] = useState(null);

  const load = useCallback(async (background = false) => {
    if (!background) setLoading(true);
    try {
      const status = filterTab === "pending" ? undefined : filterTab;
      const [data, settingsData] = await Promise.all([
        api.listDecisions(status),
        api.getOrgSettings().catch(() => ({ display_currency: "USD" })),
      ]);
      const list = data.decisions ?? [];
      setDecisions(list);
      if (list.length > 0 && !selected) setSelected(list[0]);
      setOrgSettings(settingsData);
    } catch (e) { console.error(e); }
    finally { if (!background) setLoading(false); }
  }, [filterTab]);

  useEffect(() => {
    setSelected(null);
    load();
  }, [filterTab]);

  const handleApprove = async (id) => {
    setActionLoading("approve");
    try { await api.approveDecision(id); await load(true); setSelected(null); }
    finally { setActionLoading(null); }
  };

  const handleReject = async (id) => {
    setActionLoading("reject");
    try { await api.rejectDecision(id); await load(true); setSelected(null); }
    finally { setActionLoading(null); }
  };

  const currency = orgSettings?.display_currency ?? "USD";
  const approvalThreshold = orgSettings?.approval_threshold_usd ?? 5000;
  const secondThreshold = orgSettings?.second_approver_threshold_usd;

  const tabs = [
    { key: "pending",  label: "Pending" },
    { key: "approved", label: "Approved" },
    { key: "rejected", label: "Rejected" },
  ];

  return (
    <div className="split-layout" style={{ margin: "-28px -32px", minHeight: "calc(100vh - 56px)" }}>

      {/* Left sidebar */}
      <div className="split-sidebar">
        {/* Tabs */}
        <div
          className="flex gap-1 p-3"
          style={{ borderBottom: "1px solid var(--border-subtle)" }}
        >
          {tabs.map((t) => (
            <Button
              key={t.key}
              onClick={() => setFilterTab(t.key)}
              className="flex-1 py-1.5 rounded-md text-xs font-medium transition-all"
              style={{
                background: filterTab === t.key ? "var(--bg-surface-raised)" : "transparent",
                color: filterTab === t.key ? "var(--text-primary)" : "var(--text-tertiary)",
                border: filterTab === t.key ? "1px solid var(--border-subtle)" : "1px solid transparent",
              }}
            >
              {t.label}
            </Button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-3 space-y-2">
              {[1, 2, 3].map((i) => <SkeletonBlock key={i} />)}
            </div>
          ) : decisions.length === 0 ? (
            <EmptyState compact icon={<CheckCircle2 size={16} />} title={`No ${filterTab} decisions`} />
          ) : (
            decisions.map((d) => {
              const isSelected = selected?.id === d.id;
              return (
                <button
                  key={d.id}
                  onClick={() => setSelected(d)}
                  className="w-full block text-left px-4 py-3.5 relative transition-colors"
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
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p
                      className="text-sm font-medium truncate"
                      style={{ color: isSelected ? "var(--accent)" : "var(--text-primary)" }}
                    >
                      {d.vendor_name ?? d.file_name ?? "Unknown Vendor"}
                    </p>
                    {d.risk_level && <RiskBadge level={d.risk_level} />}
                  </div>
                  <p
                    className="text-xs truncate mb-2"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {d.situation?.slice(0, 60) ?? "Awaiting review"}
                    {d.situation?.length > 60 ? "…" : ""}
                  </p>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={d.approval_status} />
                    {d.expected_impact?.savings_annual != null && (
                      <span
                        className="text-xs font-mono font-medium"
                        style={{ color: "var(--status-success)" }}
                      >
                        <CurrencyValue amount={d.expected_impact.savings_annual} currency={currency} />
                      </span>
                    )}
                  </div>
                  {d.requires_second_approver && (
                    <div
                      className="flex items-center gap-1 mt-2 text-[10px] font-medium"
                      style={{ color: "var(--status-warning-text)" }}
                    >
                      <Users size={10} /> 2nd Approver Required
                    </div>
                  )}
                </button>
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
              icon={<Bell size={18} />}
              title="Select a decision to review"
              description="Choose from the queue on the left."
            />
          </div>
        ) : (
          <div className="p-7 w-full max-w-3xl mx-auto">

            {/* Decision header */}
            <div className="mb-7">
              <div className="flex items-center gap-2.5 mb-1">
                <h2
                  style={{
                    fontSize: 20,
                    fontWeight: 600,
                    letterSpacing: "-0.025em",
                    color: "var(--text-primary)",
                  }}
                >
                  {selected.vendor_name ?? "Unknown Vendor"}
                </h2>
                {selected.risk_level && <RiskBadge level={selected.risk_level} />}
                {selected.requires_second_approver && (
                  <span
                    className="badge badge-warning"
                    style={{ display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <AlertTriangle size={10} /> 2nd Approver
                  </span>
                )}
              </div>
              {selected.file_name && (
                <p className="text-xs font-mono" style={{ color: "var(--text-tertiary)" }}>
                  {selected.file_name}
                </p>
              )}
            </div>

            <div className="space-y-4">

              {/* AI Analysis */}
              <div className="surface-card p-5">
                <div
                  className="flex items-center gap-2 mb-4 pb-3.5"
                  style={{ borderBottom: "1px solid var(--border-subtle)" }}
                >
                  <Cpu size={14} style={{ color: "var(--accent)" }} />
                  <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)", letterSpacing: "0.06em" }}>
                    AI Analysis
                  </h3>
                  <span className="badge badge-accent ml-auto" style={{ fontSize: 10 }}>LLM Output</span>
                </div>

                <div className="space-y-4">
                  {selected.situation && (
                    <div>
                      <p className="text-xs font-medium mb-2" style={{ color: "var(--text-tertiary)" }}>Situation</p>
                      <p
                        className="text-sm leading-relaxed p-3.5 rounded-md"
                        style={{
                          color: "var(--text-secondary)",
                          background: "var(--bg-surface-raised)",
                          border: "1px solid var(--border-subtle)",
                        }}
                      >
                        {selected.situation}
                      </p>
                    </div>
                  )}
                  {selected.root_cause && (
                    <div>
                      <p className="text-xs font-medium mb-2" style={{ color: "var(--text-tertiary)" }}>Root Cause</p>
                      <p
                        className="text-sm leading-relaxed p-3.5 rounded-md"
                        style={{
                          color: "var(--text-secondary)",
                          background: "var(--bg-surface-raised)",
                          border: "1px solid var(--border-subtle)",
                        }}
                      >
                        {selected.root_cause}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                    <div className="surface-inset p-3.5">
                      <p className="text-[10px] font-medium uppercase tracking-wider mb-1.5" style={{ color: "var(--text-tertiary)" }}>
                        Recommended
                      </p>
                      <p className="text-sm font-medium capitalize" style={{ color: "var(--accent)" }}>
                        {selected.recommended_action?.replace(/_/g, " ") ?? "—"}
                      </p>
                    </div>
                    {selected.expected_impact?.savings_annual != null && (
                      <div
                        className="p-3.5 rounded-lg"
                        style={{ background: "var(--status-success-muted)", border: "1px solid var(--status-success-border)" }}
                      >
                        <p className="text-[10px] font-medium uppercase tracking-wider mb-1.5" style={{ color: "var(--status-success-text)" }}>
                          Potential Savings
                        </p>
                        <p className="text-base font-semibold font-mono" style={{ color: "var(--status-success-text)" }}>
                          <CurrencyValue amount={selected.expected_impact.savings_annual} currency={currency} />
                        </p>
                      </div>
                    )}
                    {selected.contract_value_annual != null && (
                      <div className="surface-inset p-3.5">
                        <p className="text-[10px] font-medium uppercase tracking-wider mb-1.5" style={{ color: "var(--text-tertiary)" }}>
                          Contract Value
                        </p>
                        <p className="text-base font-semibold font-mono" style={{ color: "var(--text-primary)" }}>
                          <CurrencyValue amount={selected.contract_value_annual} currency={currency} />
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {selected.confidence != null && (
                  <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                    <RiskMeter confidence={selected.confidence} riskLevel={selected.risk_level} />
                  </div>
                )}
              </div>

              {/* Policy Evaluation */}
              <div className="surface-card p-5">
                <div
                  className="flex items-center gap-2 mb-4 pb-3.5"
                  style={{ borderBottom: "1px solid var(--border-subtle)" }}
                >
                  <Zap size={14} style={{ color: "var(--text-tertiary)" }} />
                  <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)", letterSpacing: "0.06em" }}>
                    Policy Evaluation
                  </h3>
                  <span className="badge badge-neutral ml-auto" style={{ fontSize: 10 }}>Deterministic</span>
                </div>
                <div className="space-y-1">
                  <PolicyRuleRow
                    label="Human Approval Required"
                    description={`Financial impact exceeds org threshold`}
                    evaluated={selected.expected_impact?.savings_annual != null
                      ? currency === "INR"
                        ? `₹${Math.round(selected.expected_impact.savings_annual * 83.5).toLocaleString("en-IN")}`
                        : `$${Math.round(selected.expected_impact.savings_annual).toLocaleString()}`
                      : undefined}
                    threshold={currency === "INR"
                      ? `₹${Math.round(approvalThreshold * 83.5).toLocaleString("en-IN")}`
                      : `$${approvalThreshold.toLocaleString()}`}
                    passed={selected.requires_approval}
                  />
                  {secondThreshold && (
                    <PolicyRuleRow
                      label="Second Approver Required"
                      description="Financial impact exceeds second approver threshold"
                      threshold={currency === "INR"
                        ? `₹${Math.round(secondThreshold * 83.5).toLocaleString("en-IN")}`
                        : `$${secondThreshold.toLocaleString()}`}
                      passed={selected.requires_second_approver ?? false}
                    />
                  )}
                  <PolicyRuleRow
                    label="AI Confidence Sufficient"
                    evaluated={selected.confidence != null ? `${Math.round(selected.confidence * 100)}%` : undefined}
                    threshold="60%"
                    passed={selected.confidence != null ? selected.confidence >= 0.6 : null}
                  />
                </div>
              </div>

              {/* Approval Chain */}
              <div className="surface-card p-5">
                <div
                  className="flex items-center gap-2 mb-4 pb-3.5"
                  style={{ borderBottom: "1px solid var(--border-subtle)" }}
                >
                  <Clock size={14} style={{ color: "var(--text-tertiary)" }} />
                  <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)", letterSpacing: "0.06em" }}>
                    Approval Chain
                  </h3>
                </div>
                <div className="space-y-4 pl-1">
                  {[
                    { label: "AI Analysis Completed", done: true },
                    { label: "Policy Rules Evaluated", done: true },
                    {
                      label: "Human Approval",
                      done: ["approved", "rejected", "auto_approved"].includes(selected.approval_status),
                      active: selected.approval_status === "pending",
                      status: selected.approval_status,
                    },
                    ...(selected.requires_second_approver ? [{
                      label: "Second Approver",
                      done: false,
                      active: selected.approval_status === "approved",
                      isWarning: true,
                    }] : []),
                    { label: "Action Execution", done: selected.approval_status === "approved" },
                  ].map((step, i) => (
                    <div key={i} className="flex items-center gap-3.5 relative">
                      {/* Step icon */}
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 border"
                        style={{
                          background: step.done ? "var(--status-success-muted)" : step.active ? "var(--accent-muted)" : "var(--bg-surface-raised)",
                          borderColor: step.done ? "var(--status-success)" : step.active ? "var(--accent)" : "var(--border-default)",
                        }}
                      >
                        {step.done
                          ? <CheckCircle2 size={10} style={{ color: "var(--status-success)" }} />
                          : step.active
                          ? <Clock size={10} style={{ color: "var(--accent)" }} />
                          : <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--border-default)" }} />
                        }
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className="text-sm font-medium"
                            style={{
                              color: step.done ? "var(--text-primary)" : step.active ? "var(--accent)" : "var(--text-disabled)",
                            }}
                          >
                            {step.label}
                          </span>
                          {step.isWarning && (
                            <span className="badge badge-warning" style={{ fontSize: 10 }}>Required</span>
                          )}
                        </div>
                        {step.active && (
                          <span className="text-xs" style={{ color: "var(--accent)", opacity: 0.8 }}>
                            Awaiting decision
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              {selected.approval_status === "pending" && (
                <div className="surface-card p-5">
                  <h3
                    className="text-xs font-semibold uppercase tracking-wider mb-4 pb-3.5"
                    style={{ color: "var(--text-secondary)", letterSpacing: "0.06em", borderBottom: "1px solid var(--border-subtle)" }}
                  >
                    Your Decision
                  </h3>
                  {selected.requires_second_approver && (
                    <div
                      className="flex items-start gap-2.5 p-3.5 rounded-lg text-sm mb-4"
                      style={{
                        background: "var(--status-warning-muted)",
                        border: "1px solid var(--status-warning-border)",
                        color: "var(--status-warning-text)",
                      }}
                    >
                      <AlertTriangle size={14} style={{ marginTop: 1, flexShrink: 0 }} />
                      <span>This decision requires a second approver. Your approval initiates the next review stage.</span>
                    </div>
                  )}
                  <div className="flex gap-3 mb-4">
                    <Button
                      onClick={() => handleApprove(selected.id)}
                      disabled={!!actionLoading}
                      className="btn btn-success btn-lg flex-1"
                    >
                      <CheckCircle2 size={15} />
                      {actionLoading === "approve" ? "Approving…" : "Approve"}
                    </Button>
                    <Button
                      onClick={() => handleReject(selected.id)}
                      disabled={!!actionLoading}
                      className="btn btn-destructive btn-lg flex-1"
                    >
                      <XCircle size={15} />
                      {actionLoading === "reject" ? "Rejecting…" : "Reject"}
                    </Button>
                  </div>
                  <Link
                    href={`/contracts/${selected.contract_id}`}
                    className="btn btn-secondary btn-lg w-full"
                    style={{ width: "100%", display: "flex" }}
                  >
                    <FileText size={14} /> View Full Contract Analysis
                  </Link>
                </div>
              )}

              {selected.approval_status !== "pending" && (
                <div
                  className="flex items-center gap-3 px-5 py-4 rounded-lg"
                  style={{
                    background: selected.approval_status === "approved" ? "var(--status-success-muted)" : "var(--status-danger-muted)",
                    border: `1px solid ${selected.approval_status === "approved" ? "var(--status-success-border)" : "var(--status-danger-border)"}`,
                  }}
                >
                  {selected.approval_status === "approved"
                    ? <CheckCircle2 size={18} style={{ color: "var(--status-success)", flexShrink: 0 }} />
                    : <XCircle size={18} style={{ color: "var(--status-danger)", flexShrink: 0 }} />
                  }
                  <p
                    className="text-sm font-medium"
                    style={{ color: selected.approval_status === "approved" ? "var(--status-success-text)" : "var(--status-danger-text)" }}
                  >
                    Decision {selected.approval_status === "approved" ? "Approved" : "Rejected"}
                    {selected.decided_at && (
                      <span style={{ opacity: 0.7 }}>
                        {" "}· {new Date(selected.decided_at).toLocaleString()}
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}