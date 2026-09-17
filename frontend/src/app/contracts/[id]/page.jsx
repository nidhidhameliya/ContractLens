"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import RiskBadge from "@/components/ui/RiskBadge";
import StatusBadge from "@/components/ui/StatusBadge";
import PipelineNode from "@/app/contracts/components/PipelineNode";
import PolicyRuleRow from "@/app/contracts/components/PolicyRuleRow";
import RiskMeter from "@/components/ui/RiskMeter";
import TimelineEvent from "@/app/contracts/components/TimelineEvent";
import EmptyState from "@/components/ui/EmptyState";
import CurrencyValue from "@/components/ui/CurrencyValue";
import LiveScanMonitor from "@/app/contracts/components/LiveScanMonitor";
import Button from "@/components/ui/Button";
import {
  ArrowLeft, ScanLine, Loader2, FileText, RotateCcw,
  Calendar, DollarSign, RefreshCw, AlertTriangle, Cpu,
  CheckCircle2, Clock, Building2, Zap, Users, Trash2
} from "lucide-react";



export default function ContractDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [auditEvents, setAuditEvents] = useState([]);
  const [orgSettings, setOrgSettings] = useState(null);
  // Live pipeline animation state while scanning
  const [liveStage, setLiveStage] = useState(null);
  // Ref to track scanning so effects don't interfere
  const scanningRef = React.useRef(false);

  const load = useCallback(async (background = false) => {
    if (!background) setLoading(true);
    try {
      const [contractData, auditData] = await Promise.all([
      api.getContract(id),
      api.listAuditLogs({ contract_id: id, limit: 50 })]
      );
      setContract(contractData);
      setAuditEvents(auditData.events || []);
    } catch (e) {
      console.error(e);
    } finally {
      if (!background) setLoading(false);
    }
  }, [id]);

  useEffect(() => {load();}, [id]);

  // Load org settings for currency
  useEffect(() => {
    api.getOrgSettings().then(setOrgSettings).catch(() => {});
  }, []);

  // Poll while contract is in scanning state (for externally-triggered scans)
  // but never interfere when triggerScan() is already managing state
  useEffect(() => {
    if (contract?.status === "scanning" && !scanningRef.current) {
      const interval = setInterval(() => load(true), 2500);
      return () => clearInterval(interval);
    }
  }, [contract?.status, load]);

  // Cached fresh contract from poll — used when animation finishes
  const latestContractRef = React.useRef(null);

  const PIPELINE_STAGES = [
    { key: "ingestion", label: "Contract Parser",   icon: "📄", desc: "Reading and tokenising document text…"        },
    { key: "detection", label: "Clause Detection",  icon: "🔍", desc: "Extracting structured clauses via LLM…"       },
    { key: "usage",     label: "Usage Signals",     icon: "📊", desc: "Fetching vendor utilisation via MCP…"         },
    { key: "risk",      label: "Risk Analysis",     icon: "⚠️",  desc: "Evaluating contractual risk factors…"        },
    { key: "finance",   label: "Finance Model",     icon: "💰", desc: "Modelling cost impact and savings…"           },
    { key: "decision",  label: "Decision Agent",    icon: "🤖", desc: "Generating procurement recommendation…"       },
    { key: "rules",     label: "Policy Rules",      icon: "📋", desc: "Applying deterministic approval rules…"       },
  ];

  const triggerScan = async () => {
    if (scanningRef.current) return; // prevent double-clicks
    scanningRef.current = true;
    latestContractRef.current = null;
    setScanning(true);
    setActiveTab("pipeline");

    try {
      await api.triggerScan(id);
    } catch (e) {
      console.error("Scan trigger failed:", e);
      setScanning(false);
      scanningRef.current = false;
      return;
    }

    const TOTAL = PIPELINE_STAGES.length;
    const STAGE_MS = 3800; // each stage shows for ~3.8s → full animation = ~26s
    let backendDone = false;
    let animDone = false;

    const finishMonitor = async () => {
      // Both backend AND animation complete — load results and close
      setScanning(false);
      scanningRef.current = false;
      setLiveStage(null);
      const fresh = latestContractRef.current;
      if (fresh) {
        setContract(fresh);
        try {
          const auditData = await api.listAuditLogs({ contract_id: id, limit: 50 });
          setAuditEvents(auditData.events || []);
        } catch (_) {}
      } else {
        await load(true);
      }
    };

    // ── Animation: advance through every stage at fixed cadence ──────────
    let stage = 0;
    setLiveStage(0);
    const stageTimer = setInterval(() => {
      stage += 1;
      setLiveStage(stage);
      if (stage >= TOTAL) {
        clearInterval(stageTimer);
        animDone = true;
        if (backendDone) finishMonitor();
      }
    }, STAGE_MS);

    // ── Backend poll: check until status leaves "scanning" ─────────────
    const pollTimer = setInterval(async () => {
      try {
        const fresh = await api.getContract(id);
        if (fresh.status !== "scanning") {
          clearInterval(pollTimer);
          latestContractRef.current = fresh;
          backendDone = true;
          if (animDone) finishMonitor();
          // else: animation still running — just wait for it
        }
      } catch (_) {}
    }, 3000);
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete "${contract?.file_name}"? This cannot be undone.`)) return;
    try {
      await api.deleteContract(id);
      router.push("/contracts");
    } catch (err) {
      alert(err.message || "Failed to delete contract");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen p-6 lg:p-8">
        <div className="space-y-4">
          <div className="h-7 w-40 rounded-md skeleton" />
          <div className="h-32 rounded-md skeleton" />
          <div className="h-64 rounded-md skeleton" />
          <div className="h-80 rounded-md skeleton" />
        </div>
      </div>);

  }

  if (!contract) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <EmptyState
          icon={<FileText size={18} />}
          title="Contract not found"
          description="This contract may have been deleted or you may not have access."
          action={
          <Button
            onClick={() => router.push("/contracts")}
            className="text-sm font-medium"
            style={{ color: "var(--accent)" }}>
            
              Back to Contracts
            </Button>
          } />
        
      </div>);

  }

  const currency = orgSettings?.display_currency ?? "USD";
  const clause = contract.clauses?.[0];
  const decision = contract.decisions?.[0];
  const agentRuns = contract.agent_runs ?? [];

  // Build pipeline nodes from actual agent_runs
  const PIPELINE_ORDER = ["detection", "risk", "finance", "decision", "rule_check"];
  const agentRunMap = {};
  agentRuns.forEach((r) => {agentRunMap[r.agent_name] = r;});

  const pipelineNodes = PIPELINE_ORDER.map((name) => {
    const run = agentRunMap[name];
    if (!run) {
      return { agentName: name, status: "pending", label: nodeLabelMap[name] };
    }
    return {
      agentName: name,
      label: nodeLabelMap[name],
      status: run.status,
      confidence: run.confidence,
      reasoningSummary: run.reasoning_summary,
      mcpToolCalls: (run.mcp_tool_calls || []).map((t) =>
      typeof t === "string" ?
      { tool: t, server: "mcp" } :
      { tool: t.tool ?? t.name ?? String(t), server: t.server ?? "mcp" }
      ),
      startedAt: run.started_at,
      completedAt: run.completed_at
    };
  });

  const tabs = [
  { key: "overview", label: "Overview" },
  { key: "pipeline", label: "Intelligence Pipeline", count: agentRuns.length },
  { key: "analysis", label: "AI Analysis & Decision" },
  { key: "document", label: "Document & Clauses" },
  { key: "audit", label: "Audit History", count: auditEvents.length }];


  return (
    <div className="min-h-screen">
      {/* Live Scan Overlay */}
      <LiveScanMonitor 
        fileName={contract?.file_name ?? ""} 
        visible={scanning} 
        externalStage={liveStage} 
        onClose={() => {
          setScanning(false);
          scanningRef.current = false;
          setLiveStage(null);
          load(true);
        }}
      />

      {/* Back nav */}
      <div className="px-6 lg:px-8 pt-6 pb-0">
        <Button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm mb-5 transition-colors"
          style={{ color: "var(--text-tertiary)" }}
          onMouseEnter={(e) => e.currentTarget.style.color = "var(--text-primary)"}
          onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-tertiary)"}>
          
          <ArrowLeft size={14} />
          Contracts
        </Button>

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
                {clause?.vendor_name ?? "Unknown Vendor"}
              </h1>
              {decision?.risk_level && <RiskBadge level={decision.risk_level} />}
              <StatusBadge status={contract.status} />
            </div>
            <p className="text-sm font-mono" style={{ color: "var(--text-tertiary)" }}>
              {contract.file_name}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleDelete}
              className="p-2 rounded-md transition-colors"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--status-error-border)", color: "var(--status-error)" }}
              title="Delete Contract">
              <Trash2 size={14} />
            </Button>
            <Button
              onClick={() => load(true)}
              className="p-2 rounded-md transition-colors"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}
              title="Refresh">
              
              <RefreshCw size={14} />
            </Button>
            <Button
              onClick={triggerScan}
              disabled={scanning || contract.status === "scanning"}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-40"
              style={{ background: "var(--accent)", color: "var(--accent-text)" }}>
              
              {scanning || contract.status === "scanning" ?
              <Loader2 size={14} className="animate-spin-slow" /> :

              <ScanLine size={14} />
              }
              {scanning || contract.status === "scanning" ? "Scanning…" : "Run AI Scan"}
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div
          className="flex gap-0 -mb-px"
          style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          
          {tabs.map((t) => {
            const active = activeTab === t.key;
            return (
              <Button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className="px-4 py-2.5 text-sm font-medium transition-colors relative"
                style={{
                  color: active ? "var(--text-primary)" : "var(--text-tertiary)",
                  borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
                  background: "transparent",
                  marginBottom: "-1px"
                }}>
                
                {t.label}
                {t.count !== undefined && t.count > 0 &&
                <span
                  className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full tabular-nums"
                  style={{ background: "var(--bg-surface-raised)", color: "var(--text-disabled)" }}>
                  
                    {t.count}
                  </span>
                }
              </Button>);

          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="px-6 lg:px-8 py-6">

        {/* OVERVIEW TAB */}
        {activeTab === "overview" &&
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Metadata card */}
            <div
            className="lg:col-span-2 rounded-md p-5"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
            
              <h2 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "var(--text-secondary)" }}>
                Contract Metadata
              </h2>
              <dl className="grid grid-cols-2 gap-x-8 gap-y-4">
                {[
              {
                label: "Vendor",
                value: clause?.vendor_name ?? "—",
                icon: <Building2 size={13} />
              },
              {
                label: "Annual Value",
                value: clause ?
                <CurrencyValue amount={clause.contract_value_annual} currency={currency} /> :
                "—",
                icon: <DollarSign size={13} />
              },
              {
                label: "Renewal Date",
                value: clause?.renewal_date ?
                new Date(clause.renewal_date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) :
                "—",
                icon: <Calendar size={13} />
              },
              {
                label: "Auto-Renew",
                value: clause?.auto_renew === true ?
                <span style={{ color: "var(--status-warning)" }}>⚠ Yes — Auto-renew active</span> :
                clause?.auto_renew === false ? "No" : "—",
                icon: <RotateCcw size={13} />
              },
              {
                label: "Notice Period",
                value: clause?.notice_period_days ? `${clause.notice_period_days} days` : "—",
                icon: <Clock size={13} />
              },
              {
                label: "Price Escalation",
                value: clause?.price_escalation_pct ? `${clause.price_escalation_pct}%/yr` : "—",
                icon: <AlertTriangle size={13} />
              },
              {
                label: "Last Scanned",
                value: contract.last_scanned_at ?
                new Date(contract.last_scanned_at).toLocaleString() :
                "Never",
                icon: <Cpu size={13} />
              },
              {
                label: "Source",
                value: contract.source?.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()) ?? "—",
                icon: <FileText size={13} />
              }].
              map(({ label, value, icon }) =>
              <div key={label}>
                    <dt className="flex items-center gap-1.5 text-xs font-medium mb-1" style={{ color: "var(--text-tertiary)" }}>
                      {icon} {label}
                    </dt>
                    <dd className="text-sm" style={{ color: "var(--text-primary)" }}>
                      {value}
                    </dd>
                  </div>
              )}
              </dl>

              {clause?.ambiguous_clauses?.length > 0 &&
            <div
              className="mt-5 p-3 rounded-md"
              style={{
                background: "var(--status-warning-muted)",
                border: "1px solid var(--status-warning-border)"
              }}>
              
                  <p className="text-xs font-semibold mb-2" style={{ color: "var(--status-warning)" }}>
                    ⚠ Ambiguous Clauses Detected
                  </p>
                  <ul className="space-y-1">
                    {clause.ambiguous_clauses.map((c, i) =>
                <li key={i} className="text-xs" style={{ color: "var(--status-warning)" }}>• {c}</li>
                )}
                  </ul>
                </div>
            }
            </div>

            {/* Side panel */}
            <div className="space-y-4">
              {/* Decision summary */}
              {decision ?
            <div
              className="rounded-md p-4"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
              
                  <h2 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "var(--text-secondary)" }}>
                    Latest Decision
                  </h2>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>Risk Level</span>
                      {decision.risk_level ? <RiskBadge level={decision.risk_level} /> : <span style={{ color: "var(--text-disabled)" }}>—</span>}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>Approval</span>
                      <StatusBadge status={decision.approval_status} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>Action</span>
                      <span className="text-xs font-medium capitalize" style={{ color: "var(--text-primary)" }}>
                        {decision.recommended_action?.replace(/_/g, " ") ?? "—"}
                      </span>
                    </div>
                    {decision.expected_impact?.savings_annual != null &&
                <div className="flex items-center justify-between">
                        <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>Potential Savings</span>
                        <span className="text-xs font-semibold" style={{ color: "var(--status-success)" }}>
                          <CurrencyValue amount={decision.expected_impact.savings_annual} currency={currency} />
                        </span>
                      </div>
                }
                  </div>
                  {decision.approval_status === "pending" &&
              <Link
                href="/approvals"
                className="mt-3 flex items-center gap-1.5 w-full justify-center px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
                style={{ background: "var(--accent)", color: "var(--accent-text)" }}>
                
                      Review Decision →
                    </Link>
              }
                </div> :

            <div
              className="rounded-md p-4"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
              
                  <EmptyState
                compact
                icon={<Cpu size={16} />}
                title="Not yet scanned"
                description="Run an AI scan to generate a risk decision for this contract." />
              
                </div>
            }

              {/* Extraction confidence */}
              {clause?.extraction_confidence != null &&
            <RiskMeter
              confidence={clause.extraction_confidence}
              threshold={0.6}
              riskLevel={decision?.risk_level} />

            }
            </div>
          </div>
        }

        {/* PIPELINE TAB */}
        {activeTab === "pipeline" &&
        <div className="max-w-2xl">
            <div className="mb-5">
              <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                Contract Intelligence Pipeline
              </h2>
              <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                The AI analysis pipeline stages — based on actual agent execution records. Policy rules run deterministically, never by the LLM.
              </p>
            </div>

            {/* LIVE SCANNING VIEW */}
            {liveStage !== null ? (
              <div className="space-y-3 pt-2">
                {PIPELINE_STAGES.map((stage, i) => {
                  const isDone = i < liveStage;
                  const isActive = i === liveStage;
                  const isPending = i > liveStage;
                  return (
                    <div
                      key={stage.key}
                      className="flex items-start gap-4 p-4 rounded-xl transition-all duration-500"
                      style={{
                        background: isActive ? "var(--bg-surface)" : "var(--bg-surface-raised)",
                        border: isActive ? "1px solid var(--accent)" : "1px solid var(--border-subtle)",
                        boxShadow: isActive ? "0 0 0 3px color-mix(in srgb, var(--accent) 12%, transparent)" : "none",
                        opacity: isPending ? 0.45 : 1,
                        transform: isActive ? "scale(1.01)" : "scale(1)",
                      }}
                    >
                      {/* Status icon */}
                      <div
                        className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-base"
                        style={{
                          background: isDone ? "color-mix(in srgb, var(--status-success) 15%, transparent)"
                            : isActive ? "color-mix(in srgb, var(--accent) 15%, transparent)"
                            : "var(--bg-surface-raised)",
                          border: isDone ? "1px solid var(--status-success)"
                            : isActive ? "1px solid var(--accent)"
                            : "1px solid var(--border-subtle)",
                        }}
                      >
                        {isDone ? (
                          <CheckCircle2 size={16} style={{ color: "var(--status-success)" }} />
                        ) : isActive ? (
                          <Loader2 size={16} className="animate-spin" style={{ color: "var(--accent)" }} />
                        ) : (
                          <span style={{ fontSize: 14 }}>{stage.icon}</span>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold" style={{ color: isDone || isActive ? "var(--text-primary)" : "var(--text-tertiary)" }}>
                            {stage.label}
                          </span>
                          {isDone && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: "color-mix(in srgb, var(--status-success) 12%, transparent)", color: "var(--status-success)" }}>
                              Complete
                            </span>
                          )}
                          {isActive && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full animate-pulse" style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)", color: "var(--accent)" }}>
                              Running…
                            </span>
                          )}
                        </div>
                        <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                          {isActive ? stage.desc : isDone ? "Completed successfully" : "Waiting…"}
                        </p>
                        {/* Progress bar for active stage */}
                        {isActive && (
                          <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: "var(--bg-surface-raised)" }}>
                            <div
                              className="h-full rounded-full"
                              style={{
                                background: "var(--accent)",
                                animation: "scan-progress 3.5s ease-in-out infinite",
                                width: "60%",
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : agentRuns.length === 0 ? (
              <EmptyState
                icon={<Cpu size={18} />}
                title="No pipeline runs yet"
                description="Trigger a scan to run the AI analysis pipeline on this contract." />
            ) : (
              <div className="pt-2">
                {/* Ingestion pseudo-node */}
                <PipelineNode
                  agentName="ingestion"
                  label="Contract Ingestion"
                  status="completed"
                  reasoningSummary={`Document ingested: ${contract.file_name}`}
                  startedAt={contract.uploaded_at}
                  completedAt={contract.last_scanned_at} />

                {pipelineNodes.map((node, i) =>
                  <PipelineNode
                    key={node.agentName}
                    {...node}
                    isLast={i === pipelineNodes.length - 1} />
                )}


                {/* Rule check pseudo-node */}
                {decision && (
                  <PipelineNode
                    agentName="rule_check"
                    label="Deterministic Policy Rules"
                    status="completed"
                    reasoningSummary={
                      decision.requires_approval
                        ? `Human approval required: Impact threshold exceeded`
                        : `Auto-approved: Below approval threshold`
                    }
                    isLast />
                )}
              </div>
            )}
          </div>
        }

        {/* ANALYSIS TAB */}
        {activeTab === "analysis" &&
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {!decision ?
          <div className="lg:col-span-2">
                <EmptyState
              icon={<Cpu size={18} />}
              title="No AI analysis yet"
              description="Run a scan to generate an AI decision for this contract." />
            
              </div> :

          <>
                {/* AI Analysis */}
                <div className="space-y-4">
                  <div
                className="rounded-md p-5"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
                
                    <div className="flex items-center gap-2 mb-4">
                      <Cpu size={14} style={{ color: "var(--accent)" }} />
                      <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
                        AI Analysis
                      </h2>
                      <span
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                    style={{
                      background: "var(--accent-muted)",
                      color: "var(--accent)",
                      border: "1px solid var(--accent-border)"
                    }}>
                    
                        LLM OUTPUT
                      </span>
                    </div>
                    <div className="space-y-4">
                      {decision.situation &&
                  <div>
                          <p className="text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                            Situation
                          </p>
                          <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
                            {decision.situation}
                          </p>
                        </div>
                  }
                      {decision.root_cause &&
                  <div>
                          <p className="text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                            Root Cause
                          </p>
                          <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
                            {decision.root_cause}
                          </p>
                        </div>
                  }
                      {decision.recommended_action &&
                  <div>
                          <p className="text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                            Recommended Action
                          </p>
                          <p className="text-sm font-semibold capitalize" style={{ color: "var(--accent)" }}>
                            {decision.recommended_action.replace(/_/g, " ")}
                          </p>
                        </div>
                  }
                    </div>
                  </div>

                  {/* Confidence meter */}
                  <RiskMeter
                confidence={decision.confidence}
                threshold={0.6}
                riskLevel={decision.risk_level} />
              

                  {/* Financial impact */}
                  {decision.expected_impact &&
              <div
                className="rounded-md p-5"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
                
                      <h2 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "var(--text-secondary)" }}>
                        Expected Financial Impact
                      </h2>
                      <div className="space-y-2">
                        {Object.entries(decision.expected_impact).map(([k, v]) =>
                  <div key={k} className="flex items-center justify-between text-sm">
                            <span className="capitalize text-xs" style={{ color: "var(--text-tertiary)" }}>
                              {k.replace(/_/g, " ")}
                            </span>
                            <span className="font-semibold font-mono" style={{ color: "var(--status-success)" }}>
                              <CurrencyValue amount={Number(v)} currency={currency} />
                            </span>
                          </div>
                  )}
                      </div>
                    </div>
              }
                </div>

                {/* Policy Evaluation */}
                <div
              className="rounded-md p-5"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
              
                  <div className="flex items-center gap-2 mb-4">
                    <Zap size={14} style={{ color: "var(--text-secondary)" }} />
                    <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
                      Policy Rule Evaluation
                    </h2>
                    <span
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                  style={{
                    background: "var(--bg-surface-raised)",
                    color: "var(--text-disabled)",
                    border: "1px solid var(--border-subtle)"
                  }}>
                  
                      NOT AI
                    </span>
                  </div>
                  <p className="text-xs mb-4" style={{ color: "var(--text-tertiary)" }}>
                    These rules are evaluated deterministically in Python — they are never influenced by the LLM.
                  </p>
                  <div>
                    <PolicyRuleRow
                  label="Human Approval Required"
                  description="Triggered when estimated financial impact exceeds the org approval threshold."
                  evaluated={
                  decision.expected_impact?.savings_annual != null ?
                  `$${Math.round(decision.expected_impact.savings_annual).toLocaleString()}` :
                  undefined
                  }
                  threshold="Org threshold"
                  passed={decision.requires_approval} />
                
                    <PolicyRuleRow
                  label="Second Approver Required"
                  description="Triggered when financial impact exceeds the second approver threshold."
                  passed={decision.requires_second_approver ?? false} />
                
                    <PolicyRuleRow
                  label="AI Confidence Above Threshold"
                  description="Minimum confidence required to trust the AI output."
                  evaluated={decision.confidence != null ? `${Math.round(decision.confidence * 100)}%` : undefined}
                  threshold="60%"
                  passed={decision.confidence != null ? decision.confidence >= 0.6 : null} />
                
                  </div>

                  {/* Approval chain visualization */}
                  <div className="mt-5 pt-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-secondary)" }}>
                      Approval Chain
                    </p>
                    <div className="space-y-2">
                      {[
                  { label: "AI Analysis", done: true },
                  { label: "Policy Evaluation", done: true },
                  {
                    label: "Human Approval",
                    done: ["approved", "rejected", "auto_approved"].includes(decision.approval_status),
                    active: decision.approval_status === "pending",
                    status: decision.approval_status
                  },
                  ...(decision.requires_second_approver ?
                  [{
                    label: "Second Approver",
                    done: false,
                    active: decision.approval_status === "approved",
                    isWarning: true
                  }] :
                  [])].
                  map((step, i) =>
                  <div key={i} className="flex items-center gap-2.5">
                          <div
                      className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                      style={{
                        background: step.done ?
                        "var(--status-success-muted)" :
                        step.active ?
                        "var(--accent-muted)" :
                        "var(--bg-surface-raised)",
                        border: `1px solid ${
                        step.done ?
                        "var(--status-success-border)" :
                        step.active ?
                        "var(--accent-border)" :
                        "var(--border-subtle)"}`

                      }}>
                      
                            {step.done ?
                      <CheckCircle2 size={11} style={{ color: "var(--status-success)" }} /> :
                      step.active ?
                      <Clock size={11} style={{ color: "var(--accent)" }} /> :

                      <div className="w-2 h-2 rounded-full" style={{ background: "var(--border-subtle)" }} />
                      }
                          </div>
                          <span
                      className="text-xs font-medium"
                      style={{
                        color: step.done ?
                        "var(--status-success)" :
                        step.active ?
                        "var(--text-primary)" :
                        "var(--text-disabled)"
                      }}>
                      
                            {step.label}
                          </span>
                          {step.isWarning &&
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded"
                      style={{
                        background: "var(--status-warning-muted)",
                        color: "var(--status-warning)",
                        border: "1px solid var(--status-warning-border)"
                      }}>
                      
                              Required
                            </span>
                    }
                          {step.active &&
                    <span
                      className="text-xs"
                      style={{ color: "var(--accent)" }}>
                      
                              · Awaiting decision
                            </span>
                    }
                        </div>
                  )}
                    </div>
                    {decision.approval_status === "pending" &&
                <Link
                  href="/approvals"
                  className="mt-4 flex items-center gap-1.5 w-full justify-center px-3 py-1.5 rounded-md text-xs font-medium"
                  style={{ background: "var(--accent)", color: "var(--accent-text)" }}>
                  
                        <Users size={12} />
                        Go to Approvals
                      </Link>
                }
                  </div>
                </div>
              </>
          }
          </div>
        }

        {/* DOCUMENT & CLAUSES TAB */}
        {activeTab === "document" &&
        <div className="space-y-5 max-w-4xl">
            {/* Clause Risk Highlights */}
            {clause &&
          <div
            className="rounded-xl p-5"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
            
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle size={13} style={{ color: "var(--status-warning)" }} />
                  <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
                    Extracted Risk Clauses
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
              {
                label: "Auto-Renew",
                value: clause.auto_renew === true ? "⚠ Yes — renews automatically" : clause.auto_renew === false ? "✓ No" : "Not found",
                risk: clause.auto_renew === true ? "high" : "low"
              },
              {
                label: "Notice Period",
                value: clause.notice_period_days ? `${clause.notice_period_days} days` : "Not found",
                risk: (clause.notice_period_days ?? 999) < 30 ? "high" : "low"
              },
              {
                label: "Price Escalation",
                value: clause.price_escalation_pct ? `${clause.price_escalation_pct}% per year` : "None found",
                risk: (clause.price_escalation_pct ?? 0) > 5 ? "high" : (clause.price_escalation_pct ?? 0) > 0 ? "medium" : "low"
              },
              {
                label: "Renewal Date",
                value: clause.renewal_date ? new Date(clause.renewal_date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "Not specified",
                risk: (() => {
                  if (!clause.renewal_date) return "medium";
                  const days = Math.ceil((new Date(clause.renewal_date).getTime() - Date.now()) / 86400000);
                  return days < 60 ? "high" : days < 180 ? "medium" : "low";
                })()
              },
              {
                label: "Contract Value (Annual)",
                value: clause.contract_value_annual ? `$${Number(clause.contract_value_annual).toLocaleString()} ${clause.currency ?? "USD"}` : "Not specified",
                risk: "low"
              },
              {
                label: "Ambiguous Clauses",
                value: clause.ambiguous_clauses?.length > 0 ? `${clause.ambiguous_clauses.length} flagged` : "None detected",
                risk: clause.ambiguous_clauses?.length > 0 ? "medium" : "low"
              }].
              map(({ label, value, risk }) =>
              <div
                key={label}
                className="rounded-lg p-3.5"
                style={{
                  background: risk === "high" ? "var(--status-danger-muted)" : risk === "medium" ? "var(--status-warning-muted)" : "var(--bg-surface-raised)",
                  border: `1px solid ${
                  risk === "high" ? "var(--status-danger-border)" : risk === "medium" ? "var(--status-warning-border)" : "var(--border-subtle)"}`

                }}>
                
                      <p
                  className="text-[10px] font-semibold uppercase tracking-wider mb-1"
                  style={{ color: risk === "high" ? "var(--status-danger)" : risk === "medium" ? "var(--status-warning)" : "var(--text-tertiary)" }}>
                  
                        {label}
                      </p>
                      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                        {value}
                      </p>
                    </div>
              )}
                </div>

                {clause.ambiguous_clauses?.length > 0 &&
            <div className="mt-4 p-3.5 rounded-lg" style={{ background: "var(--status-warning-muted)", border: "1px solid var(--status-warning-border)" }}>
                    <p className="text-xs font-semibold mb-2" style={{ color: "var(--status-warning)" }}>⚠ Ambiguous Clause Details</p>
                    <ul className="space-y-1">
                      {clause.ambiguous_clauses.map((c, i) =>
                <li key={i} className="text-xs" style={{ color: "var(--status-warning)" }}>• {c}</li>
                )}
                    </ul>
                  </div>
            }
              </div>
          }

            {/* Raw Text Viewer with keyword highlighting */}
            {contract.raw_text &&
          <div
            className="rounded-xl p-5"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
            
                <div className="flex items-center gap-2 mb-4">
                  <FileText size={13} style={{ color: "var(--accent)" }} />
                  <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
                    Raw Contract Text
                  </h2>
                  <span className="text-[10px] px-2 py-0.5 rounded-full ml-auto" style={{ background: "var(--bg-surface-raised)", color: "var(--text-tertiary)", border: "1px solid var(--border-subtle)" }}>
                    {contract.raw_text.length.toLocaleString()} chars
                  </span>
                </div>
                <div
              className="text-xs leading-relaxed overflow-y-auto rounded-lg p-4 font-mono max-h-96 whitespace-pre-wrap"
              style={{
                background: "var(--bg-canvas)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-secondary)"
              }}
              dangerouslySetInnerHTML={{
                __html: contract.raw_text.
                replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").
                replace(
                  /(auto.?renew|automatic renewal|automatically renew)/gi,
                  '<mark style="background:rgba(248,81,73,0.2);color:var(--status-danger);border-radius:3px;padding:0 2px">$1</mark>'
                ).
                replace(
                  /(price escalation|rate increase|annual increase|\d+\.?\d*%\s*(per|a)\s*year)/gi,
                  '<mark style="background:rgba(210,153,34,0.2);color:var(--status-warning);border-radius:3px;padding:0 2px">$1</mark>'
                ).
                replace(
                  /(notice period|written notice|days.{0,20}notice|notice.{0,20}days)/gi,
                  '<mark style="background:rgba(63,185,80,0.15);color:var(--status-success);border-radius:3px;padding:0 2px">$1</mark>'
                )
              }} />
            
                <div className="flex gap-4 mt-3">
                  {[
              { color: "var(--status-danger)", bg: "rgba(248,81,73,0.15)", label: "Auto-Renew" },
              { color: "var(--status-warning)", bg: "rgba(210,153,34,0.15)", label: "Price Escalation" },
              { color: "var(--status-success)", bg: "rgba(63,185,80,0.12)", label: "Notice Period" }].
              map(({ color, bg, label }) =>
              <span key={label} className="flex items-center gap-1.5 text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                      <span className="w-3 h-3 rounded-sm inline-block" style={{ background: bg, border: `1px solid ${color}` }} />
                      {label}
                    </span>
              )}
                </div>
              </div>
          }

            {/* PDF Viewer */}
            {contract.file_name?.toLowerCase().endsWith(".pdf") &&
          <div
            className="rounded-xl p-5"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
            
                <h2 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "var(--text-secondary)" }}>
                  PDF Document
                </h2>
                <div
              className="rounded-lg flex items-center justify-center py-12 text-center"
              style={{ background: "var(--bg-canvas)", border: "1px dashed var(--border-default)" }}>
              
                  <div>
                    <FileText size={32} className="mx-auto mb-3" style={{ color: "var(--text-disabled)" }} />
                    <p className="text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                      {contract.file_name}
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                      PDF viewer requires the file to be served from storage. The extracted text is shown above.
                    </p>
                  </div>
                </div>
              </div>
          }
          </div>
        }

        {/* AUDIT TAB */}
        {activeTab === "audit" &&
        <div className="max-w-2xl">
            <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
              Audit History
            </h2>
            <p className="text-xs mb-5" style={{ color: "var(--text-tertiary)" }}>
              Immutable record of all events related to this contract.
            </p>
            {auditEvents.length === 0 ?
          <EmptyState
            icon={<Clock size={18} />}
            title="No events yet"
            description="Events will appear here as the contract is processed and decisions are made." /> :


          <div className="pt-2">
                {auditEvents.map((e, i) =>
            <TimelineEvent
              key={e.id}
              action={e.action}
              entityType={e.entity_type}
              userId={e.user_id}
              detail={e.detail}
              timestamp={e.timestamp}
              isLast={i === auditEvents.length - 1} />

            )}
              </div>
          }
          </div>
        }
      </div>
    </div>);

}

const nodeLabelMap = {
  detection: "Detection Agent",
  risk: "Risk Analysis Agent",
  finance: "Finance Agent",
  decision: "Decision Agent",
  rule_check: "Policy Rule Engine",
  action: "Action Agent"
};