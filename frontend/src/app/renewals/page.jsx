"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import Link from "next/link";
import { AlertTriangle, Clock, CheckCircle2, Calendar, RefreshCw, TrendingUp, DollarSign } from "lucide-react";
import Button from "@/components/ui/Button";

const BUCKET_CONFIG = {
  expired:  { label: "Expired",        accentColor: "var(--text-disabled)",      badgeClass: "badge-neutral",  icon: Clock },
  critical: { label: "Critical ≤30d",  accentColor: "var(--status-danger)",      badgeClass: "badge-danger",   icon: AlertTriangle },
  warning:  { label: "Warning 31–60d", accentColor: "var(--status-warning)",     badgeClass: "badge-warning",  icon: AlertTriangle },
  watch:    { label: "Watch 61–90d",   accentColor: "var(--accent)",             badgeClass: "badge-accent",   icon: Calendar },
  safe:     { label: "Safe >90d",      accentColor: "var(--status-success)",     badgeClass: "badge-success",  icon: CheckCircle2 },
};

function SkeletonBlock({ h = 80 }) {
  return <div className="skeleton" style={{ height: h, borderRadius: 6 }} />;
}

function RenewalCard({ entry, cfg }) {
  const daysLabel =
    entry.days_until_renewal < 0
      ? `Expired ${Math.abs(entry.days_until_renewal)}d ago`
      : entry.days_until_renewal === 0
      ? "Renews today"
      : `${entry.days_until_renewal}d`;

  return (
    <Link
      href={`/contracts/${entry.contract_id}`}
      className="block surface-card p-4 group"
      style={{
        textDecoration: "none",
        transition: "box-shadow var(--transition-base), border-color var(--transition-base)",
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "var(--shadow-md)";
        e.currentTarget.style.borderColor = "var(--border-default)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "var(--shadow-sm)";
        e.currentTarget.style.borderColor = "var(--border-subtle)";
      }}
    >
      {/* Left accent bar */}
      <div
        style={{
          position: "absolute", left: 0, top: 0, bottom: 0, width: 2,
          background: cfg.accentColor,
        }}
      />

      <div className="flex items-start justify-between gap-2 mb-3 pl-1">
        <p
          className="text-sm font-medium"
          style={{
            color: "var(--text-primary)",
            transition: "color var(--transition-base)",
          }}
        >
          {entry.vendor_name}
        </p>
        <span className={`badge ${cfg.badgeClass}`} style={{ fontSize: 10, whiteSpace: "nowrap" }}>
          {daysLabel}
        </span>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 pl-1">
        <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-tertiary)" }}>
          <Calendar size={12} />
          {new Date(entry.renewal_date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
        </span>
        {entry.contract_value_annual && (
          <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-tertiary)" }}>
            <DollarSign size={12} />
            {entry.contract_value_annual.toLocaleString()} {entry.currency}/yr
          </span>
        )}
        {entry.auto_renew && (
          <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--status-warning)" }}>
            <RefreshCw size={12} /> Auto-renews
          </span>
        )}
        {entry.notice_deadline && (
          <span className="flex items-center gap-1.5 text-xs" style={{ color: cfg.accentColor }}>
            <Clock size={12} />
            Notice by {new Date(entry.notice_deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        )}
        {entry.recommended_action && (
          <span className="flex items-center gap-1.5 text-xs capitalize" style={{ color: cfg.accentColor }}>
            <TrendingUp size={12} />
            {entry.recommended_action.replace(/_/g, " ")}
          </span>
        )}
      </div>
    </Link>
  );
}

export default function RenewalsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { const res = await api.getRenewals(); setData(res); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const summary = data?.summary ?? {};
  const buckets = data?.buckets ?? {};

  return (
    <div className="w-full max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.03em", color: "var(--text-primary)", lineHeight: 1.1 }}>
            Renewal Calendar
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-tertiary)" }}>
            {data?.today
              ? `As of ${new Date(data.today).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`
              : "Contract renewal timeline"}
          </p>
        </div>
        <Button onClick={load} variant="secondary" size="sm">
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      {/* KPI row */}
      {!loading && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-7">
          {Object.keys(BUCKET_CONFIG).map((key) => {
            const cfg = BUCKET_CONFIG[key];
            const count = summary[key] ?? 0;
            const Icon = cfg.icon;
            return (
              <div
                key={key}
                className="surface-card p-4 text-center"
                style={{
                  borderTop: count > 0 ? `2px solid ${cfg.accentColor}` : "2px solid var(--border-subtle)",
                }}
              >
                <p
                  style={{
                    fontSize: 26,
                    fontWeight: 600,
                    letterSpacing: "-0.03em",
                    color: count > 0 ? cfg.accentColor : "var(--text-disabled)",
                    lineHeight: 1,
                    marginBottom: 6,
                  }}
                >
                  {count}
                </p>
                <p className="text-[11px] font-medium" style={{ color: "var(--text-tertiary)" }}>
                  {cfg.label}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Bucket sections */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <SkeletonBlock key={i} h={100} />)}
        </div>
      ) : summary.total === 0 ? (
        <div
          className="surface-card p-12 text-center"
        >
          <Calendar size={28} className="mx-auto mb-3" style={{ color: "var(--text-disabled)" }} />
          <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>No renewals found</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
            Scan contracts with renewal dates to populate this calendar.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.keys(BUCKET_CONFIG)
            .filter((key) => (buckets[key]?.length ?? 0) > 0)
            .map((key) => {
              const cfg = BUCKET_CONFIG[key];
              const Icon = cfg.icon;
              return (
                <section key={key}>
                  <div className="flex items-center gap-2.5 mb-3.5">
                    <Icon size={14} style={{ color: cfg.accentColor }} />
                    <h2 className="text-sm font-semibold" style={{ color: cfg.accentColor }}>
                      {cfg.label}
                    </h2>
                    <span className={`badge ${cfg.badgeClass}`} style={{ fontSize: 10 }}>
                      {buckets[key].length}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {buckets[key].map((entry) => (
                      <RenewalCard key={entry.contract_id} entry={entry} cfg={cfg} />
                    ))}
                  </div>
                </section>
              );
            })}
        </div>
      )}
    </div>
  );
}