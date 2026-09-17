"use client";

export default function EmptyState({ icon, title, description, action, compact = false }) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        compact ? "py-10 px-6" : "py-20 px-8"
      }`}
    >
      {icon && (
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center mb-4"
          style={{
            background: "var(--bg-surface-raised)",
            border: "1px solid var(--border-subtle)",
            color: "var(--text-disabled)",
          }}
        >
          {icon}
        </div>
      )}

      <p
        className="text-sm font-medium mb-1"
        style={{ color: "var(--text-primary)" }}
      >
        {title}
      </p>

      {description && (
        <p
          className="text-xs max-w-xs leading-relaxed"
          style={{ color: "var(--text-tertiary)" }}
        >
          {description}
        </p>
      )}

      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}