"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  TrendingUp, DollarSign, CheckCircle2, XCircle, Clock,
  BarChart3, Target, Award, AlertTriangle } from
"lucide-react";

function StatCard({
  label, value, sub, icon: Icon, color = "var(--accent)"
}) {
  return (
    <div
      className="rounded-xl p-5 flex gap-4 items-start"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
      
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `color-mix(in srgb, ${color} 12%, transparent)` }}>
        
        <Icon size={18} style={{ color }} />
      </div>
      <div>
        <p className="text-xs font-medium mb-1" style={{ color: "var(--text-tertiary)" }}>
          {label}
        </p>
        <p className="text-2xl font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
          {value}
        </p>
        {sub &&
        <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
            {sub}
          </p>
        }
      </div>
    </div>);

}

function MiniBar({ label, high, medium, low, total }) {
  if (total === 0) return null;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs" style={{ color: "var(--text-secondary)" }}>
        <span>{label}</span>
        <span className="font-mono" style={{ color: "var(--text-tertiary)" }}>{total} contracts</span>
      </div>
      <div className="flex rounded-full overflow-hidden h-2 gap-px">
        {high > 0 &&
        <div
          style={{ width: `${high / total * 100}%`, background: "var(--status-danger)" }}
          title={`High: ${high}`} />

        }
        {medium > 0 &&
        <div
          style={{ width: `${medium / total * 100}%`, background: "var(--status-warning)" }}
          title={`Medium: ${medium}`} />

        }
        {low > 0 &&
        <div
          style={{ width: `${low / total * 100}%`, background: "var(--status-success)" }}
          title={`Low: ${low}`} />

        }
      </div>
      <div className="flex gap-4 text-[10px]">
        <span style={{ color: "var(--status-danger)" }}>● High: {high}</span>
        <span style={{ color: "var(--status-warning)" }}>● Med: {medium}</span>
        <span style={{ color: "var(--status-success)" }}>● Low: {low}</span>
      </div>
    </div>);

}

export default function AnalyticsPage() {
  const [outcomes, setOutcomes] = useState(null);
  const [trend, setTrend] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getOutcomeAnalytics(), api.getRiskTrend(90)]).
    then(([o, t]) => {setOutcomes(o);setTrend(t);}).
    catch(console.error).
    finally(() => setLoading(false));
  }, []);

  const formatUSD = (n) =>
  n >= 1_000_000 ?
  `$${(n / 1_000_000).toFixed(1)}M` :
  n >= 1_000 ?
  `$${(n / 1_000).toFixed(0)}K` :
  `$${n.toFixed(0)}`;

  return (
    <div className="p-6 lg:p-8 space-y-8 w-full">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
          Analytics
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-tertiary)" }}>
          ROI tracking, outcome verification, and risk portfolio trends
        </p>
      </div>

      {loading ?
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) =>
        <div key={i} className="h-28 rounded-xl skeleton" />
        )}
        </div> :

      <>
          {/* KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
            label="Predicted Savings"
            value={formatUSD(outcomes?.total_predicted_savings ?? 0)}
            sub="Across all approved decisions"
            icon={TrendingUp}
            color="var(--accent)" />
          
            <StatCard
            label="Verified Savings"
            value={formatUSD(outcomes?.total_actual_savings ?? 0)}
            sub={outcomes?.accuracy_pct ? `${outcomes.accuracy_pct}% accuracy` : "Awaiting verification"}
            icon={DollarSign}
            color="var(--status-success)" />
          
            <StatCard
            label="Successful Outcomes"
            value={String(outcomes?.wins ?? 0)}
            sub={`${outcomes?.losses ?? 0} failures · ${outcomes?.pending_verification ?? 0} pending`}
            icon={Award}
            color="var(--status-success)" />
          
            <StatCard
            label="Total Decisions"
            value={String(outcomes?.total_decisions ?? 0)}
            sub={`${trend?.total_scanned ?? 0} in last 90 days`}
            icon={Target}
            color="var(--text-secondary)" />
          
          </div>

          {/* Risk Trend Chart */}
          <div
          className="rounded-xl p-5"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
          
            <div className="flex items-center gap-2 mb-5">
              <BarChart3 size={14} style={{ color: "var(--accent)" }} />
              <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Risk Trend — Last 90 Days
              </h2>
              <span
              className="text-[10px] px-2 py-0.5 rounded-full ml-auto"
              style={{ background: "var(--bg-surface-raised)", color: "var(--text-tertiary)", border: "1px solid var(--border-subtle)" }}>
              
                by week
              </span>
            </div>

            {!trend?.data_points?.length ?
          <p className="text-sm text-center py-8" style={{ color: "var(--text-tertiary)" }}>
                No data yet — scan some contracts to see trends.
              </p> :

          <div className="space-y-3">
                {trend.data_points.map((pt) =>
            <MiniBar
              key={pt.week}
              label={pt.week}
              high={pt.high ?? 0}
              medium={pt.medium ?? 0}
              low={pt.low ?? 0}
              total={pt.total ?? 0} />

            )}
              </div>
          }
          </div>

          {/* Vendor Breakdown */}
          {outcomes?.vendor_breakdown?.length > 0 &&
        <div
          className="rounded-xl p-5"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
          
              <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
                Outcome Breakdown by Vendor
              </h2>
              <div className="space-y-0">
                {/* Header */}
                <div
              className="grid grid-cols-4 gap-4 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-tertiary)" }}>
              
                  <span>Vendor</span>
                  <span className="text-right">Predicted</span>
                  <span className="text-right">Actual</span>
                  <span className="text-right">Result</span>
                </div>
                {outcomes.vendor_breakdown.map((v, i) =>
            <div
              key={i}
              className="grid grid-cols-4 gap-4 px-3 py-3 rounded-lg"
              style={{
                background: i % 2 === 0 ? "transparent" : "var(--bg-surface-raised)"
              }}>
              
                    <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                      {v.vendor}
                    </span>
                    <span className="text-sm font-mono text-right" style={{ color: "var(--text-secondary)" }}>
                      {formatUSD(v.predicted_savings)}
                    </span>
                    <span className="text-sm font-mono text-right" style={{ color: "var(--status-success)" }}>
                      {formatUSD(v.actual_savings)}
                    </span>
                    <div className="flex justify-end">
                      {v.result === "success" ?
                <span className="flex items-center gap-1 text-xs" style={{ color: "var(--status-success)" }}>
                          <CheckCircle2 size={11} /> Success
                        </span> :
                v.result === "failure" ?
                <span className="flex items-center gap-1 text-xs" style={{ color: "var(--status-danger)" }}>
                          <XCircle size={11} /> Failed
                        </span> :

                <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
                          <Clock size={11} /> Pending
                        </span>
                }
                    </div>
                  </div>
            )}
              </div>
            </div>
        }
        </>
      }
    </div>);

}