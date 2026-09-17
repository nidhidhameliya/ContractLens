const CONFIG = {
  high: {
    label: "High Risk",
    badgeClass: "badge-danger",
    dotColor: "var(--status-danger)",
    pulse: true,
  },
  medium: {
    label: "Medium Risk",
    badgeClass: "badge-warning",
    dotColor: "var(--status-warning)",
    pulse: false,
  },
  low: {
    label: "Low Risk",
    badgeClass: "badge-success",
    dotColor: "var(--status-success)",
    pulse: false,
  },
  none: {
    label: "No Risk",
    badgeClass: "badge-neutral",
    dotColor: "var(--status-neutral)",
    pulse: false,
  },
};

export default function RiskBadge({ level }) {
  const c = CONFIG[level] ?? CONFIG.none;
  return (
    <span className={`badge ${c.badgeClass}`}>
      <span
        className={`inline-block shrink-0 rounded-full ${c.pulse ? "animate-pulse-dot" : ""}`}
        style={{ width: 5, height: 5, background: "currentColor", opacity: 0.75 }}
      />
      {c.label}
    </span>
  );
}