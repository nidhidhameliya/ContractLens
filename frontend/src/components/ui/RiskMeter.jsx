"use client";

const RISK_COLORS = {
  low:    "var(--status-success)",
  medium: "var(--status-warning)",
  high:   "var(--status-danger)",
};

export default function RiskMeter({ confidence, threshold = 0.6, riskLevel, compact = false }) {
  const pct = confidence != null ? Math.min(Math.max(confidence, 0), 1) * 100 : null;
  const thresholdPct = threshold * 100;
  const passed = pct != null ? pct >= thresholdPct : null;
  const barColor = riskLevel
    ? RISK_COLORS[riskLevel] ?? "var(--accent)"
    : "var(--accent)";

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div
          className="flex-1 rounded-full overflow-hidden"
          style={{ height: 4, background: "var(--bg-surface-raised)" }}
        >
          {pct != null && (
            <div
              className="h-full rounded-full animate-gauge-fill"
              style={{ width: `${pct}%`, background: barColor }}
            />
          )}
        </div>
        <span
          className="text-xs font-mono tabular-nums"
          style={{ color: "var(--text-secondary)", minWidth: 30, textAlign: "right" }}
        >
          {pct != null ? `${Math.round(pct)}%` : "—"}
        </span>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg p-4"
      style={{
        background: "var(--bg-surface-raised)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-xs font-medium"
          style={{ color: "var(--text-secondary)" }}
        >
          AI Confidence Score
        </span>
        {riskLevel && (
          <span
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: barColor }}
          >
            {riskLevel} risk
          </span>
        )}
      </div>

      {/* Track */}
      <div
        className="relative rounded-full overflow-hidden mb-3"
        style={{ height: 6, background: "var(--border-subtle)" }}
      >
        {pct != null && (
          <div
            className="h-full rounded-full animate-gauge-fill"
            style={{ width: `${pct}%`, background: barColor }}
          />
        )}
        {/* Threshold marker */}
        <div
          className="absolute top-0 bottom-0 w-px"
          style={{
            left: `${thresholdPct}%`,
            background: "var(--border-strong)",
          }}
          title={`Threshold: ${Math.round(thresholdPct)}%`}
        />
      </div>

      <div className="flex items-center justify-between">
        <span
          className="text-xs font-mono tabular-nums"
          style={{ color: "var(--text-primary)" }}
        >
          Score: <strong>{pct != null ? `${Math.round(pct)}%` : "—"}</strong>
        </span>
        <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
          Min: {Math.round(thresholdPct)}%
        </span>
        {passed !== null && (
          <span
            className="text-xs font-medium"
            style={{ color: passed ? "var(--status-success)" : "var(--status-danger)" }}
          >
            {passed ? "✓ Passed" : "✗ Below threshold"}
          </span>
        )}
      </div>
    </div>
  );
}