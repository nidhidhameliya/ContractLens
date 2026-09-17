"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import StatusBadge from "@/components/ui/StatusBadge";
import { Trash2, Loader2, Save, CheckCircle2, DollarSign, Sliders, Link as LinkIcon, Plus } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

const MCP_SERVERS = [
  { type: "google_drive", name: "Google Drive", description: "Read contracts from shared Drive folders" },
  { type: "gmail",        name: "Gmail",        description: "Ingest contracts from email attachments" },
  { type: "slack",        name: "Slack",        description: "Send alerts and action drafts to channels" },
  { type: "okta",         name: "Okta",         description: "Identity management and access control" },
];

const DEFAULT_SCOPES = {
  google_drive: ["search_documents", "read_file"],
  gmail:        ["list_emails", "read_email"],
  slack:        ["send_message", "list_channels"],
  okta:         ["list_users"],
};

function SkeletonBlock({ h = 40 }) {
  return <div className="skeleton" style={{ height: h, borderRadius: 6 }} />;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("policy");
  const [settings, setSettings] = useState(null);
  const [mcp, setMcp] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [approvalThreshold, setApprovalThreshold] = useState("");
  const [secondThreshold, setSecondThreshold] = useState("");
  const [displayCurrency, setDisplayCurrency] = useState("USD");

  const [connecting, setConnecting] = useState(null);
  const [mcpUrls, setMcpUrls] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsData, mcpData] = await Promise.all([
        api.getOrgSettings(),
        api.listMcpConnections(),
      ]);
      setSettings(settingsData);
      setApprovalThreshold(String(settingsData.approval_threshold_usd ?? 5000));
      setSecondThreshold(String(settingsData.second_approver_threshold_usd ?? ""));
      setDisplayCurrency(settingsData.display_currency ?? "USD");
      setMcp(Array.isArray(mcpData) ? mcpData : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { Promise.resolve().then(load); }, [load]);

  const saveSettings = async () => {
    setSaving(true);
    try {
      await api.updateOrgSettings({
        approval_threshold_usd: parseFloat(approvalThreshold) || 5000,
        second_approver_threshold_usd: secondThreshold ? parseFloat(secondThreshold) : null,
        display_currency: displayCurrency,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      await load();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const connectMcp = async (serverType) => {
    const url = mcpUrls[serverType] || "";
    if (!url) return;
    setConnecting(serverType);
    try { await api.connectMcpServer(serverType, { url }); await load(); }
    catch (e) { alert(e.message); }
    finally { setConnecting(null); }
  };

  const disconnectMcp = async (serverType) => {
    if (!confirm("Disconnect this integration?")) return;
    setConnecting(serverType);
    try { await api.disconnectMcpServer(serverType); await load(); }
    catch (e) { alert(e.message); }
    finally { setConnecting(null); }
  };

  const getMcpStatus = (serverType) => mcp.find((c) => c.server_type === serverType);

  const tabs = [
    { key: "policy",       label: "Policy Rules",  icon: <Sliders size={14} /> },
    { key: "integrations", label: "Integrations",  icon: <LinkIcon size={14} /> },
    { key: "organization", label: "Organization",  icon: <DollarSign size={14} /> },
  ];

  if (loading) {
    return (
      <div className="flex gap-8 w-full max-w-full">
        <div className="space-y-2" style={{ width: 180, flexShrink: 0 }}>
          {[1, 2, 3].map((i) => <SkeletonBlock key={i} h={36} />)}
        </div>
        <div className="flex-1 space-y-5">
          <SkeletonBlock h={160} />
          <SkeletonBlock h={120} />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full">
      <div className="flex gap-8">

        {/* Tab sidebar */}
        <div style={{ width: 180, flexShrink: 0 }}>
          <nav className="space-y-0.5">
            {tabs.map((t) => (
              <Button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-all"
                style={{
                  background: activeTab === t.key ? "var(--bg-surface)" : "transparent",
                  color: activeTab === t.key ? "var(--text-primary)" : "var(--text-tertiary)",
                  border: activeTab === t.key ? "1px solid var(--border-subtle)" : "1px solid transparent",
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== t.key) {
                    e.currentTarget.style.background = "var(--bg-surface-raised)";
                    e.currentTarget.style.color = "var(--text-secondary)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== t.key) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "var(--text-tertiary)";
                  }
                }}
              >
                <span style={{ color: activeTab === t.key ? "var(--accent)" : "var(--text-disabled)" }}>
                  {t.icon}
                </span>
                {t.label}
              </Button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-5">

          {/* POLICY */}
          {activeTab === "policy" && (
            <>
              <div className="surface-card p-6">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign size={16} style={{ color: "var(--accent)" }} />
                  <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
                    Approval Thresholds
                  </h2>
                </div>
                <p className="text-sm mb-7" style={{ color: "var(--text-tertiary)" }}>
                  Thresholds are evaluated deterministically — never influenced by AI. Values stored in USD.
                </p>

                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                      Human Approval Threshold (USD)
                    </label>
                    <p className="text-xs mb-3" style={{ color: "var(--text-tertiary)" }}>
                      Contracts with impact above this value require human approval before any action.
                    </p>
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm font-medium" style={{ color: "var(--text-tertiary)" }}>$</span>
                      <Input
                        type="number"
                        value={approvalThreshold}
                        onChange={(e) => setApprovalThreshold(e.target.value)}
                        className="input-field font-mono"
                        style={{ maxWidth: 200 }}
                        placeholder="5000"
                      />
                    </div>
                  </div>

                  <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 20 }}>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                      Second Approver Threshold (USD) — Optional
                    </label>
                    <p className="text-xs mb-3" style={{ color: "var(--text-tertiary)" }}>
                      Contracts above this value require additional executive approval. Leave blank to disable.
                    </p>
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm font-medium" style={{ color: "var(--text-tertiary)" }}>$</span>
                      <Input
                        type="number"
                        value={secondThreshold}
                        onChange={(e) => setSecondThreshold(e.target.value)}
                        className="input-field font-mono"
                        style={{ maxWidth: 200 }}
                        placeholder="50000 (optional)"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* How it works */}
              <div
                className="rounded-lg p-5"
                style={{ background: "var(--bg-surface-raised)", border: "1px solid var(--border-subtle)" }}
              >
                <h3 className="text-xs font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
                  <Sliders size={12} style={{ color: "var(--text-tertiary)" }} />
                  How the Rule Engine Works
                </h3>
                <div className="space-y-3">
                  {[
                    "AI agents analyze the contract and estimate annual savings/exposure.",
                    "The deterministic rule engine (pure Python, no LLM) compares the estimate against these thresholds.",
                    "If above the approval threshold → the decision is sent to the Approvals queue.",
                    "If above the second approver threshold → a second reviewer must also approve.",
                  ].map((text, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span
                        className="font-mono text-[10px] font-bold w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5"
                        style={{ background: "var(--accent-muted)", color: "var(--accent)" }}
                      >
                        {i + 1}
                      </span>
                      <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{text}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Button onClick={saveSettings}
                  disabled={saving}
                  variant="primary" size="lg"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <CheckCircle2 size={14} /> : <Save size={14} />}
                  {saved ? "Saved" : saving ? "Saving…" : "Save Policy Rules"}
                </Button>
              </div>
            </>
          )}

          {/* INTEGRATIONS */}
          {activeTab === "integrations" && (
            <div className="space-y-4">
              {MCP_SERVERS.map((server) => {
                const conn = getMcpStatus(server.type);
                const isConnected = conn?.status === "active";
                const isLoading = connecting === server.type;

                return (
                  <div key={server.type} className="surface-card p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2.5 mb-1">
                          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                            {server.name}
                          </h3>
                          <StatusBadge status={isConnected ? "connected" : "disconnected"} />
                        </div>
                        <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                          {server.description}
                        </p>
                      </div>
                      {isConnected && (
                        <Button
                          onClick={() => disconnectMcp(server.type)}
                          disabled={isLoading}
                          className="btn btn-destructive btn-sm"
                        >
                          {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                          Disconnect
                        </Button>
                      )}
                    </div>

                    {isConnected && conn?.last_verified_at && (
                      <p className="text-[11px] mb-3" style={{ color: "var(--text-disabled)" }}>
                        Last verified: {new Date(conn.last_verified_at).toLocaleString()}
                      </p>
                    )}

                    {!isConnected && (
                      <div className="flex gap-2.5 mt-4">
                        <Input
                          type="text"
                          value={mcpUrls[server.type] ?? ""}
                          onChange={(e) => setMcpUrls((prev) => ({ ...prev, [server.type]: e.target.value }))}
                          placeholder={`MCP server URL for ${server.name}…`}
                          className="input-field font-mono flex-1"
                          style={{ fontSize: 12 }}
                        />
                        <Button
                          onClick={() => connectMcp(server.type)}
                          disabled={isLoading || !mcpUrls[server.type]}
                          className="btn btn-primary btn-sm"
                        >
                          {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                          Connect
                        </Button>
                      </div>
                    )}

                    {isConnected && (
                      <div style={{ borderTop: "1px solid var(--border-subtle)", marginTop: 16, paddingTop: 14 }}>
                        <p className="text-[10px] font-medium uppercase tracking-wider mb-2.5" style={{ color: "var(--text-tertiary)", letterSpacing: "0.06em" }}>
                          Granted Scopes
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {(() => {
                            const scopes = conn?.scopes_granted
                              ? JSON.parse(conn.scopes_granted)
                              : DEFAULT_SCOPES[server.type] ?? [];
                            return scopes.map((s) => (
                              <span
                                key={s}
                                className="text-[11px] font-mono font-medium px-2.5 py-1 rounded-md"
                                style={{
                                  background: "var(--status-success-muted)",
                                  color: "var(--status-success-text)",
                                  border: "1px solid var(--status-success-border)",
                                }}
                              >
                                ✓ {s}
                              </span>
                            ));
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ORGANIZATION */}
          {activeTab === "organization" && (
            <>
              <div className="surface-card p-6">
                <h2 className="text-base font-semibold mb-1" style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
                  Display Preferences
                </h2>
                <p className="text-sm mb-6" style={{ color: "var(--text-tertiary)" }}>
                  Financial values will be shown in this currency. All values are stored in USD — INR uses a static display conversion.
                </p>
                <div>
                  <label className="block text-xs font-medium mb-3" style={{ color: "var(--text-secondary)" }}>
                    Display Currency
                  </label>
                  <div className="flex gap-2">
                    {["USD", "INR"].map((c) => (
                      <Button
                        key={c}
                        onClick={() => setDisplayCurrency(c)}
                        className="btn btn-lg"
                        style={{
                          background: displayCurrency === c ? "var(--accent)" : "var(--bg-surface)",
                          color: displayCurrency === c ? "#fff" : "var(--text-secondary)",
                          border: displayCurrency === c ? "1px solid transparent" : "1px solid var(--border-default)",
                          minWidth: 100,
                        }}
                      >
                        {c === "USD" ? "$ USD" : "₹ INR"}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <Button onClick={saveSettings}
                  disabled={saving}
                  variant="primary" size="lg"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <CheckCircle2 size={14} /> : <Save size={14} />}
                  {saved ? "Saved" : saving ? "Saving…" : "Save Preferences"}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}