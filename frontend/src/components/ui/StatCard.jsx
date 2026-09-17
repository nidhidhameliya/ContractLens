"use client";

import { useEffect, useRef, useState } from "react";

function AnimatedNumber({ value }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(0);

  useEffect(() => {
    if (value === ref.current) return;
    const duration = 600;
    const startTime = performance.now();
    const startValue = ref.current;

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startValue + (value - startValue) * eased);
      setDisplay(current);
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        ref.current = value;
      }
    };
    requestAnimationFrame(animate);
  }, [value]);

  return <>{display.toLocaleString()}</>;
}

export default function StatCard({ label, title, value, subtitle, icon, trend, accent, positive }) {
  const displayLabel = label ?? title ?? "";
  const isNumber = typeof value === "number";

  // Derive icon styling from semantic props
  const iconColor = accent
    ? "var(--status-warning)"
    : positive
    ? "var(--status-success)"
    : "var(--accent)";

  const iconBg = accent
    ? "var(--status-warning-muted)"
    : positive
    ? "var(--status-success-muted)"
    : "var(--accent-muted)";

  return (
    <div
      className="surface-card p-5 group"
      style={{ transition: "border-color var(--transition-base), box-shadow var(--transition-base)" }}
    >
      <div className="flex items-start justify-between mb-4">
        <p
          className="text-xs font-medium uppercase tracking-wider"
          style={{ color: "var(--text-tertiary)", letterSpacing: "0.05em" }}
        >
          {displayLabel}
        </p>
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
          style={{ background: iconBg, color: iconColor }}
        >
          {icon}
        </div>
      </div>

      <p
        className="text-2xl font-semibold tracking-tight tabular-nums"
        style={{ color: "var(--text-primary)", letterSpacing: "-0.025em" }}
      >
        {isNumber ? <AnimatedNumber value={value} /> : value}
      </p>

      {subtitle && (
        <p className="text-xs mt-1.5" style={{ color: "var(--text-tertiary)" }}>
          {subtitle}
        </p>
      )}

      {trend && (
        <div
          className="mt-3 inline-flex items-center gap-1 px-1.5 py-0.5 rounded"
          style={{
            background: "var(--bg-surface-raised)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <span
            className="text-[10px] font-semibold"
            style={{ color: trend.up ? "var(--status-success)" : "var(--status-danger)" }}
          >
            {trend.up ? "↑" : "↓"}
          </span>
          <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
            {trend.value}
          </span>
        </div>
      )}
    </div>
  );
}