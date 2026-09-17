"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Building2, RefreshCw, ChevronRight, Calendar, Search, X } from "lucide-react";
import Link from "next/link";
import RiskBadge from "@/components/ui/RiskBadge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

function SkeletonRow() {
  return <div className="skeleton" style={{ height: 52, borderRadius: 6 }} />;
}

export default function VendorsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try { const res = await api.getVendors(); setData(res); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { Promise.resolve().then(load); }, []);

  const formatUSD = (n) =>
    n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` :
    n >= 1_000 ? `$${(n / 1_000).toFixed(0)}K` :
    `$${n.toFixed(0)}`;

  const vendors = (data?.vendors ?? []).filter((v) =>
    !search || v.vendor_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="w-full max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.03em", color: "var(--text-primary)", lineHeight: 1.1 }}>
            Vendor Intelligence
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-tertiary)" }}>
            {data?.vendor_count ?? "—"} vendors
            {data?.total_portfolio_spend ? ` · ${formatUSD(data.total_portfolio_spend)} annual portfolio` : ""}
          </p>
        </div>
        <div className="flex gap-2.5">
          {/* Search */}
          <div
            className="flex items-center gap-2 px-3 rounded-md"
            style={{
              height: 34,
              background: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              minWidth: 220,
            }}
          >
            <Search size={13} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
            <Input
              type="text"
              placeholder="Search vendors…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                fontSize: 13,
                color: "var(--text-primary)",
                fontFamily: "var(--font-sans)",
              }}
            />
            {search && (
              <Button
                onClick={() => setSearch("")}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", padding: 0, display: "flex" }}
              >
                <X size={12} />
              </Button>
            )}
          </div>
          <Button onClick={load} variant="secondary" size="sm" title="Refresh">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="surface-card overflow-hidden">
        {/* Header */}
        <div
          className="grid items-center px-5 py-3"
          style={{
            gridTemplateColumns: "2fr 1fr 80px 100px 1fr",
            gap: 12,
            borderBottom: "1px solid var(--border-subtle)",
            background: "var(--bg-surface-raised)",
          }}
        >
          {["Vendor", "Annual Spend", "Contracts", "Risk", "Next Renewal"].map((h, i) => (
            <span key={h} className="data-table-header" style={{ textAlign: i >= 1 && i !== 3 ? "right" : undefined }}>
              {h}
            </span>
          ))}
        </div>

        {loading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3, 4, 5].map((i) => <SkeletonRow key={i} />)}
          </div>
        ) : vendors.length === 0 ? (
          <div className="text-center py-14">
            <Building2 size={28} className="mx-auto mb-3" style={{ color: "var(--text-disabled)" }} />
            <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
              {search ? "No vendors match your search" : "No vendors yet"}
            </p>
          </div>
        ) : (
          <div>
            {vendors.map((v, idx) => (
              <div
                key={v.vendor_name}
                className="grid items-center px-5 py-4"
                style={{
                  gridTemplateColumns: "2fr 1fr 80px 100px 1fr",
                  gap: 12,
                  borderBottom: idx < vendors.length - 1 ? "1px solid var(--border-subtle)" : "none",
                  transition: "background var(--transition-base)",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-hover)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                {/* Vendor */}
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-semibold shrink-0"
                    style={{
                      background: "var(--accent-muted)",
                      color: "var(--accent)",
                      border: "1px solid var(--accent-border)",
                    }}
                  >
                    {v.vendor_name?.[0] ?? "?"}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                      {v.vendor_name}
                    </p>
                    <div className="flex gap-1.5 mt-1">
                      {v.has_auto_renew && (
                        <span className="badge badge-warning" style={{ fontSize: 9, padding: "1px 5px" }}>Auto-renew</span>
                      )}
                      {v.avg_escalation_pct && (
                        <span className="badge badge-danger" style={{ fontSize: 9, padding: "1px 5px" }}>
                          +{v.avg_escalation_pct}%/yr
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Spend */}
                <p className="text-sm font-mono font-medium text-right tabular-nums" style={{ color: "var(--status-success)" }}>
                  {formatUSD(v.total_annual_spend)}
                </p>

                {/* Contracts */}
                <p className="text-sm font-medium text-right tabular-nums" style={{ color: "var(--text-secondary)" }}>
                  {v.contract_count}
                </p>

                {/* Risk */}
                <div>
                  {v.dominant_risk
                    ? <RiskBadge level={v.dominant_risk} />
                    : <span style={{ color: "var(--text-disabled)" }}>—</span>
                  }
                </div>

                {/* Renewal */}
                <div className="text-right">
                  {v.next_renewal ? (
                    <>
                      <p
                        className="text-sm font-semibold tabular-nums"
                        style={{
                          color: (v.days_until_next_renewal ?? 999) <= 30
                            ? "var(--status-danger)"
                            : (v.days_until_next_renewal ?? 999) <= 60
                            ? "var(--status-warning)"
                            : "var(--text-primary)",
                        }}
                      >
                        {v.days_until_next_renewal < 0 ? "Expired" : `${v.days_until_next_renewal}d`}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                        {new Date(v.next_renewal).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </>
                  ) : (
                    <span style={{ color: "var(--text-disabled)" }}>—</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Renewal CTA */}
      <Link
        href="/renewals"
        className="flex items-center justify-center gap-2.5 mt-4 py-3.5 rounded-lg text-sm font-medium transition-colors"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          color: "var(--text-secondary)",
          textDecoration: "none",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--accent-muted)";
          e.currentTarget.style.color = "var(--accent)";
          e.currentTarget.style.borderColor = "var(--accent-border)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "var(--bg-surface)";
          e.currentTarget.style.color = "var(--text-secondary)";
          e.currentTarget.style.borderColor = "var(--border-subtle)";
        }}
      >
        <Calendar size={14} />
        View Full Renewal Calendar
        <ChevronRight size={14} />
      </Link>
    </div>
  );
}