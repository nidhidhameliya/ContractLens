"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import CurrencyValue from "@/components/ui/CurrencyValue";
import EmptyState from "@/components/ui/EmptyState";
import Link from "next/link";
import {
  FileText, TrendingDown, RefreshCw, CheckCircle2,
  ArrowRight, ShieldCheck, Zap, AlertCircle, Activity
} from "lucide-react";
import Button from "@/components/ui/Button";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar
} from "recharts";

const RISK_COLORS = {
  high: "var(--status-danger)",
  medium: "var(--status-warning)",
  low: "var(--status-success)",
  unknown: "var(--text-disabled)"
};

// --- HELPER COMPONENTS ---
function SkeletonBlock({ h = 20 }) {
  return <div className="skeleton rounded-lg w-full" style={{ height: h }} />;
}

function AnimatedNumber({ value, isCurrency = false, currency = "USD" }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (value === undefined || value === null) return;
    let start = 0;
    const end = value;
    const duration = 1000;
    let startTime = null;

    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      // Ease out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.floor(easeProgress * end));
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  }, [value]);

  if (isCurrency) {
    return <CurrencyValue amount={displayValue} currency={currency} />;
  }
  return <>{displayValue.toLocaleString()}</>;
}

export default function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [decisions, setDecisions] = useState([]);
  const [orgSettings, setOrgSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async (background = false) => {
    if (!background) setLoading(true);
    setError(null);
    try {
      const [summaryData, decisionsData, settingsData] = await Promise.all([
        api.dashboardSummary(),
        api.listDecisions("pending"),
        api.getOrgSettings().catch(() => ({ display_currency: "USD" })),
      ]);
      setSummary(summaryData);
      setDecisions(decisionsData.decisions ?? []);
      setOrgSettings(settingsData);
    } catch (e) {
      setError(e.message);
    } finally {
      if (!background) setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const currency = orgSettings?.display_currency ?? "USD";
  const riskBar = summary?.risk_breakdown;
  
  const riskDonutData = riskBar ? [
    { name: "High", value: riskBar.high || 0, fill: RISK_COLORS.high },
    { name: "Medium", value: riskBar.medium || 0, fill: RISK_COLORS.medium },
    { name: "Low", value: riskBar.low || 0, fill: RISK_COLORS.low },
    { name: "Unknown", value: riskBar.unknown || 0, fill: RISK_COLORS.unknown },
  ].filter(d => d.value > 0) : [];

  return (
    <div className="w-full max-w-full">
      {/* Page header */}
      <div className="flex items-center justify-between mb-8 animate-fade-in">
        <div>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 600,
              color: "var(--text-primary)",
              letterSpacing: "-0.03em",
              lineHeight: 1.1,
            }}
          >
            Overview
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-tertiary)" }}>
            Real-time contract intelligence and exposure tracking
          </p>
        </div>
        <Button
          onClick={() => load(true)}
          disabled={loading}
          className="btn btn-secondary"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-lg mb-6 text-sm animate-slide-up"
          style={{ background: "var(--status-danger-muted)", border: "1px solid var(--status-danger-border)", color: "var(--status-danger-text)" }}
        >
          <AlertCircle size={15} style={{ flexShrink: 0 }} />
          {error}
        </div>
      )}

      {/* KPI Grid (Top Row) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        
        {/* Total Exposure */}
        <div className="surface-card hover-glow p-5 flex flex-col justify-between relative overflow-hidden animate-slide-up delay-100">
          <div className="flex items-center gap-2.5 z-10 relative mb-4">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--accent-muted)", color: "var(--accent)" }}>
              <ShieldCheck size={16} />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
              Total Exposure
            </p>
          </div>
          <div className="z-10 relative">
            <div style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-0.04em", color: "var(--text-primary)", lineHeight: 1 }}>
              {loading ? <SkeletonBlock h={32} /> : <AnimatedNumber value={summary?.total_exposure_usd} isCurrency currency={currency} />}
            </div>
          </div>
        </div>

        {/* Active Contracts */}
        <div className="surface-card hover-glow p-5 flex flex-col justify-between relative overflow-hidden animate-slide-up delay-200">
          <div className="flex items-center gap-2.5 z-10 relative mb-4">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--bg-surface-raised)", color: "var(--text-secondary)" }}>
              <FileText size={16} />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
              Contracts
            </p>
          </div>
          <div className="z-10 relative flex items-end justify-between">
            <div style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-0.04em", color: "var(--text-primary)", lineHeight: 1 }}>
              {loading ? <SkeletonBlock h={32} /> : <AnimatedNumber value={summary?.total_contracts} />}
            </div>
          </div>
        </div>

        {/* Pending Approvals */}
        <div className="surface-card hover-glow p-5 flex flex-col justify-between animate-slide-up delay-300">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--status-warning-muted)", color: "var(--status-warning)" }}>
                <Zap size={16} />
              </div>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                Pending
              </p>
            </div>
            {!loading && (summary?.pending_approvals ?? 0) > 0 && (
              <span className="animate-pulse-dot rounded-full" style={{ width: 8, height: 8, background: "var(--status-warning)" }} />
            )}
          </div>
          <div>
            <div style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-0.04em", color: "var(--text-primary)", lineHeight: 1 }}>
              {loading ? <SkeletonBlock h={32} /> : <AnimatedNumber value={summary?.pending_approvals} />}
            </div>
          </div>
        </div>

        {/* Realized Savings */}
        <div className="surface-card hover-glow p-5 flex flex-col justify-between animate-slide-up delay-400"
          style={{ background: "linear-gradient(145deg, var(--bg-surface) 0%, var(--status-success-muted) 200%)" }}
        >
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--status-success-muted)", color: "var(--status-success)" }}>
              <TrendingDown size={16} />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
              Realized Savings
            </p>
          </div>
          <div>
            <div style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-0.04em", color: "var(--status-success-text)", lineHeight: 1 }}>
              {loading ? <SkeletonBlock h={32} /> : <AnimatedNumber value={summary?.realized_savings_usd ?? 0} isCurrency currency={currency} />}
            </div>
            <p className="text-xs font-medium mt-1.5" style={{ color: "var(--status-success)" }}>
              Mitigated this quarter
            </p>
          </div>
        </div>
      </div>

      {/* Middle Row: Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        
        {/* Trajectory Chart */}
        <div className="surface-card p-6 lg:col-span-2 animate-slide-up delay-200">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
                Financial Trajectory
              </h2>
              <p className="text-sm mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                Exposure vs savings — trailing 6 months
              </p>
            </div>
          </div>
          <div style={{ height: 260 }}>
            {loading ? (
              <div className="w-full h-full skeleton rounded-lg" />
            ) : summary?.financial_trajectory ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={summary.financial_trajectory} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gExposureMain" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gSavingsMain" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--status-success)" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="var(--status-success)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--text-tertiary)", fontWeight: 500 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--text-tertiary)", fontWeight: 500 }} tickFormatter={(v) => `$${v / 1000}k`} dx={-10} width={50} />
                  <Tooltip
                    contentStyle={{ borderRadius: 10, border: "1px solid var(--border-subtle)", background: "var(--bg-surface)", boxShadow: "var(--shadow-lg)", fontSize: 13, color: "var(--text-primary)" }}
                    itemStyle={{ fontWeight: 600, paddingBottom: 4 }}
                    cursor={{ stroke: "var(--border-strong)", strokeDasharray: "4 4" }}
                  />
                  <Area type="monotone" dataKey="exposure" name="Exposure" stroke="var(--accent)" strokeWidth={3} fillOpacity={1} fill="url(#gExposureMain)" activeDot={{ r: 6, fill: "var(--accent)", stroke: "var(--bg-surface)", strokeWidth: 2 }} />
                  <Area type="monotone" dataKey="savings" name="Savings" stroke="var(--status-success)" strokeWidth={3} fillOpacity={1} fill="url(#gSavingsMain)" activeDot={{ r: 6, fill: "var(--status-success)", stroke: "var(--bg-surface)", strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full">
                <EmptyState compact icon={<Activity size={20} />} title="No Trajectory Data" description="Not enough data points yet." />
              </div>
            )}
          </div>
        </div>

        {/* Risk Distribution Donut */}
        <div className="surface-card p-6 animate-slide-up delay-300 flex flex-col">
          <div className="mb-4">
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              Risk Distribution
            </h2>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-tertiary)" }}>
              Contract risk breakdown
            </p>
          </div>
          
          <div className="flex-1 flex flex-col items-center justify-center relative">
            {loading ? (
              <div className="w-40 h-40 rounded-full skeleton border-8 border-transparent" />
            ) : riskDonutData.length === 0 ? (
              <EmptyState compact icon={<ShieldCheck size={20} />} title="No Risk Data" description="Upload contracts to see risk." />
            ) : (
              <>
                <div style={{ height: 180, width: "100%" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={riskDonutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        animationBegin={200}
                        animationDuration={1000}
                        animationEasing="ease-out"
                        stroke="none"
                      >
                        {riskDonutData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ borderRadius: 8, border: "none", background: "var(--bg-surface-raised)", boxShadow: "var(--shadow-md)", fontSize: 12, color: "var(--text-primary)", fontWeight: 600 }}
                        itemStyle={{ color: "var(--text-primary)" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* Center text for donut */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
                    {riskDonutData.reduce((acc, curr) => acc + curr.value, 0)}
                  </span>
                  <span className="text-xs uppercase tracking-wider font-semibold mt-0.5" style={{ color: "var(--text-tertiary)" }}>Total</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Priority Approvals */}
        <div className="surface-card overflow-hidden animate-slide-up delay-400">
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              Priority Approvals
            </h2>
            <Link href="/approvals" className="flex items-center gap-1.5 text-xs font-semibold btn btn-ghost btn-sm">
              View all <ArrowRight size={14} />
            </Link>
          </div>

          {loading ? (
            <div className="p-5 space-y-3">
              {[1, 2, 3].map((i) => <SkeletonBlock key={i} h={64} />)}
            </div>
          ) : decisions.length === 0 ? (
            <div className="py-12">
              <EmptyState compact icon={<CheckCircle2 size={16} />} title="All clear" description="No pending approvals right now." />
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
              {decisions.slice(0, 4).map((d, i) => (
                <Link
                  key={d.id}
                  href={`/approvals/${d.id}`}
                  className="flex items-center gap-4 px-6 py-4 transition-colors duration-200"
                  style={{ textDecoration: "none" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-hover)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 shadow-sm"
                    style={{ background: "var(--bg-surface)", color: "var(--text-primary)", border: "1px solid var(--border-default)" }}
                  >
                    {d.vendor_name?.[0] ?? "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                      {d.vendor_name ?? d.file_name ?? "Unknown Vendor"}
                    </p>
                    <p className="text-xs truncate mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                      {d.situation ? d.situation : "Pending AI review"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {d.risk_level && (
                      <span className={`badge badge-${d.risk_level === 'high' ? 'danger' : d.risk_level === 'medium' ? 'warning' : 'success'}`}>
                        {d.risk_level} risk
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* System Activity */}
        <div className="surface-card overflow-hidden animate-slide-up delay-500">
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              System Activity
            </h2>
            <Link href="/activity" className="flex items-center gap-1.5 text-xs font-semibold btn btn-ghost btn-sm">
              Full log <ArrowRight size={14} />
            </Link>
          </div>
          
          <div className="p-6">
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <SkeletonBlock key={i} h={48} />)}
              </div>
            ) : summary?.recent_activity?.length > 0 ? (
              <div className="space-y-6 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-[var(--border-default)] before:via-[var(--border-subtle)] before:to-transparent">
                {summary.recent_activity.map((item) => (
                  <div key={item.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-5 h-5 rounded-full border-2 bg-[var(--bg-surface)] shrink-0 z-10" style={{ borderColor: "var(--accent)" }}>
                       <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent)" }} />
                    </div>
                    <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-raised)] shadow-sm transition-all duration-200 group-hover:shadow-md group-hover:border-[var(--border-default)]">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{item.user || "System"}</span>
                        <span className="text-[10px] font-medium" style={{ color: "var(--text-tertiary)" }}>{item.time || "Recent"}</span>
                      </div>
                      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                        {item.action} <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{item.target}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState compact icon={<Activity size={16} />} title="No Activity" description="No recent system activity found." />
            )}
          </div>

        </div>

      </div>
    </div>
  );
}