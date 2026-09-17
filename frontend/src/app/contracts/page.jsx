"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import RiskBadge from "@/components/ui/RiskBadge";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import CurrencyValue from "@/components/ui/CurrencyValue";
import {
  Search, Upload, RefreshCw, ScanLine, FileText, Loader2,
  ChevronRight, RotateCcw, X, Mail, HardDrive, Globe, Download, Trash2,
} from "lucide-react";
import LiveScanMonitor from "@/app/contracts/components/LiveScanMonitor";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import SearchInput from "@/components/ui/Search";
import Input from "@/components/ui/Input";

const SOURCE_ICONS = {
  gmail:         <Mail size={12} />,
  google_drive:  <HardDrive size={12} />,
  manual_upload: <Upload size={12} />,
};

function SkeletonRow() {
  return <div className="skeleton" style={{ height: 52, borderRadius: 6 }} />;
}

export default function ContractsPage() {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [uploading, setUploading] = useState(false);
  const [scanning, setScanning] = useState(null);
  const [liveStage, setLiveStage] = useState(null);
  const [orgSettings, setOrgSettings] = useState(null);
  const [showExport, setShowExport] = useState(false);
  const fileInputRef = useRef(null);
  const exportRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (exportRef.current && !exportRef.current.contains(e.target)) {
        setShowExport(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const load = useCallback(async (background = false) => {
    if (!background) setLoading(true);
    try {
      const params = {};
      if (riskFilter) params.risk_level = riskFilter;
      if (statusFilter) params.status = statusFilter;
      const data = await api.listContracts(params);
      setContracts(data.contracts || []);
    } catch (e) { console.error(e); }
    finally { if (!background) setLoading(false); }
  }, [riskFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.getOrgSettings().then(setOrgSettings).catch(() => {}); }, []);

  useEffect(() => {
    const isScanning = contracts.some((c) => c.status === "scanning");
    if (!isScanning) return;
    const interval = setInterval(() => load(true), 3500);
    return () => clearInterval(interval);
  }, [contracts, load]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await api.uploadContract(file);
      await load(true);
    } catch (err) { alert(err.message); }
    finally { setUploading(false); e.target.value = ""; }
  };

  const triggerScan = async (id) => {
    if (scanning) return;
    setScanning(id);
    setLiveStage(0);

    try {
      await api.triggerScan(id);
    } catch (e) {
      console.error(e);
      setScanning(null);
      setLiveStage(null);
      return;
    }

    const TOTAL = 7; // number of stages
    const STAGE_MS = 3800;
    let backendDone = false;
    let animDone = false;

    const finishMonitor = async () => {
      setScanning(null);
      setLiveStage(null);
      await load(true);
    };

    let stage = 0;
    const stageTimer = setInterval(() => {
      stage += 1;
      setLiveStage(stage);
      if (stage >= TOTAL) {
        clearInterval(stageTimer);
        animDone = true;
        if (backendDone) finishMonitor();
      }
    }, STAGE_MS);

    const pollTimer = setInterval(async () => {
      try {
        const freshList = await api.listContracts();
        const c = freshList.contracts?.find((x) => x.id === id);
        if (c && c.status !== "scanning") {
          clearInterval(pollTimer);
          backendDone = true;
          if (animDone) finishMonitor();
        }
      } catch (_) {}
    }, 3000);
  };

  const handleDelete = async (id, fileName) => {
    if (!window.confirm(`Are you sure you want to delete "${fileName}"? This cannot be undone.`)) return;
    try {
      await api.deleteContract(id);
      await load(true);
    } catch (err) {
      alert(err.message || "Failed to delete contract");
    }
  };

  const currency = orgSettings?.display_currency ?? "USD";
  const filtered = contracts.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.file_name?.toLowerCase().includes(q) ||
           c.vendor_name?.toLowerCase().includes(q) ||
           c.status?.toLowerCase().includes(q);
  });
  const hasActiveFilters = riskFilter || statusFilter;
  const activeContract = contracts.find(c => c.id === scanning);

  return (
    <div className="w-full max-w-full">
      <LiveScanMonitor 
        fileName={activeContract?.file_name ?? ""} 
        visible={!!scanning} 
        externalStage={liveStage} 
        onClose={() => {
          setScanning(null);
          setLiveStage(null);
          load(true);
        }}
      />
      {/* Header */}
      <div className="flex items-center justify-between mb-6 animate-fade-in">
        <div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: "-0.03em",
              color: "var(--text-primary)",
              lineHeight: 1.1,
            }}
          >
            Contracts
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-tertiary)" }}>
            {contracts.length} contract{contracts.length !== 1 ? "s" : ""} monitored
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Export */}
          <div className="relative" ref={exportRef}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowExport(!showExport)}
              title="Export"
              icon={<Download size={13} />}
            />
            {showExport && (
              <div
                className="absolute right-0 top-full mt-1.5 w-52 rounded-lg overflow-hidden animate-slide-down"
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-default)",
                  boxShadow: "var(--shadow-lg)",
                  zIndex: 50,
                }}
              >
                {[
                  { label: "Export Contracts (CSV)", action: () => window.open(api.exportContractsUrl(), "_blank") },
                  { label: "Export Decisions (CSV)", action: () => window.open(api.exportDecisionsUrl(), "_blank") },
                ].map(({ label, action }) => (
                  <Button
                    key={label}
                    onClick={() => { action(); setShowExport(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm transition-colors"
                    style={{ color: "var(--text-secondary)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-hover)"; e.currentTarget.style.color = "var(--text-primary)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = ""; e.currentTarget.style.color = "var(--text-secondary)"; }}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            )}
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => load(true)}
            disabled={loading}
            title="Refresh"
            icon={<RefreshCw size={13} className={loading ? "animate-spin" : ""} />}
          />

          <Button
            variant="primary"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            loading={uploading}
            icon={<Upload size={13} />}
          >
            {uploading ? "Uploading…" : "Upload Contract"}
          </Button>
          <Input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt" onChange={handleUpload} className="hidden" />
        </div>
      </div>

      {/* Filter bar */}
      <div
        className="flex flex-wrap items-center gap-2.5 mb-5 p-3 rounded-lg animate-slide-up delay-100"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <div className="flex-1 min-w-64">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch("")}
            placeholder="Search contracts…"
          />
        </div>

        <div className="w-40">
          <Select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
          >
            <option value="">All Risk Levels</option>
            <option value="high">High Risk</option>
            <option value="medium">Medium Risk</option>
            <option value="low">Low Risk</option>
          </Select>
        </div>

        <div className="w-40">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="scanning">Scanning</option>
            <option value="manual_review">Manual Review</option>
            <option value="parse_failed">Parse Failed</option>
            <option value="archived">Archived</option>
          </Select>
        </div>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setRiskFilter(""); setStatusFilter(""); }}
            icon={<X size={12} />}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Table */}
      <div
        className="surface-card overflow-hidden animate-slide-up delay-200"
        style={{ borderRadius: "var(--radius-lg)" }}
      >
        {/* Table header */}
        <div
          className="grid items-center px-5 py-3"
          style={{
            gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 80px",
            gap: 12,
            borderBottom: "1px solid var(--border-subtle)",
            background: "var(--bg-surface-raised)",
          }}
        >
          {["Contract / Vendor", "Status", "Risk", "Annual Value", "Last Scanned", ""].map((h, i) => (
            <span
              key={i}
              className="data-table-header"
              style={{ textAlign: i >= 3 && i < 5 ? "left" : undefined }}
            >
              {h}
            </span>
          ))}
        </div>

        {loading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3, 4].map((i) => <SkeletonRow key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<FileText size={16} />}
            title={hasActiveFilters || search ? "No contracts match your filters" : "No contracts yet"}
            description={hasActiveFilters || search ? "Try adjusting your search or filters." : "Upload your first contract to begin AI risk analysis."}
            action={!hasActiveFilters && !search ? (
              <Button variant="primary" size="sm" onClick={() => fileInputRef.current?.click()} icon={<Upload size={13} />}>
                Upload Contract
              </Button>
            ) : undefined}
          />
        ) : (
          <div>
            {filtered.map((c, idx) => {
              const isScanning = c.status === "scanning" || scanning === c.id;
              const isLast = idx === filtered.length - 1;
              return (
                <div
                  key={c.id}
                  className="group grid items-center px-5 py-3.5"
                  style={{
                    gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 80px",
                    gap: 12,
                    borderBottom: isLast ? "none" : "1px solid var(--border-subtle)",
                    transition: "background var(--transition-base)",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-hover)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  {/* Contract/Vendor */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Link
                        href={`/contracts/${c.id}`}
                        className="text-sm font-medium truncate"
                        style={{ color: "var(--text-primary)", textDecoration: "none" }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-primary)"; }}
                      >
                        {c.vendor_name ?? c.file_name}
                      </Link>
                      {c.auto_renew && (
                        <span className="badge badge-warning" style={{ fontSize: 10, gap: 3, padding: "1px 6px" }}>
                          <RotateCcw size={9} /> Auto-renew
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-tertiary)" }}>
                      {SOURCE_ICONS[c.source] ?? <Globe size={11} />}
                      <span className="font-mono truncate" style={{ maxWidth: 180, fontSize: 11 }}>
                        {c.file_name}
                      </span>
                    </div>
                  </div>

                  {/* Status */}
                  <div><StatusBadge status={c.status} /></div>

                  {/* Risk */}
                  <div>
                    {c.risk_level
                      ? <RiskBadge level={c.risk_level} />
                      : <span style={{ color: "var(--text-disabled)" }}>—</span>
                    }
                  </div>

                  {/* Value */}
                  <div
                    className="text-sm font-mono tabular-nums"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {c.contract_value_annual != null
                      ? <CurrencyValue amount={c.contract_value_annual} currency={currency} />
                      : <span style={{ color: "var(--text-disabled)" }}>—</span>
                    }
                  </div>

                  {/* Last scanned */}
                  <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                    {c.last_scanned_at
                      ? new Date(c.last_scanned_at).toLocaleDateString()
                      : <span style={{ color: "var(--text-disabled)" }}>Never</span>
                    }
                  </div>

                  {/* Actions */}
                  <div
                    className="flex items-center gap-1 justify-end"
                    style={{ opacity: 0, transition: "opacity var(--transition-base)" }}
                    ref={(el) => {
                      if (el) {
                        el.parentElement?.addEventListener("mouseenter", () => el.style.opacity = "1");
                        el.parentElement?.addEventListener("mouseleave", () => el.style.opacity = "0");
                      }
                    }}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.preventDefault(); handleDelete(c.id, c.file_name); }}
                      title="Delete contract"
                      icon={<Trash2 size={13} style={{ color: "var(--status-error)" }} />}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.preventDefault(); triggerScan(c.id); }}
                      disabled={isScanning}
                      title="Run AI Scan"
                      icon={isScanning ? <Loader2 size={13} className="animate-spin" /> : <ScanLine size={13} style={{ color: "var(--text-tertiary)" }} />}
                    />
                    <Link href={`/contracts/${c.id}`} className="btn btn-ghost btn-icon btn-sm" title="View details">
                      <ChevronRight size={13} style={{ color: "var(--text-tertiary)" }} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {filtered.length > 0 && (
        <p
          className="text-xs text-center mt-4 tabular-nums"
          style={{ color: "var(--text-tertiary)" }}
        >
          Showing {filtered.length} of {contracts.length} contracts
        </p>
      )}
    </div>
  );
}