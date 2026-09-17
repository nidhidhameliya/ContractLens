import React from "react";
import { Loader2 } from "lucide-react";

export default function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  fullWidth = false,
  className = "",
  type = "button",
  icon,
  ...props
}) {
  const baseStyles =
    "inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] whitespace-nowrap";

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-5 py-2.5 text-base",
  };

  const variants = {
    primary:
      "bg-[var(--accent)] text-white hover:opacity-90 shadow-[0_4px_14px_0_color-mix(in_srgb,var(--accent)_40%,transparent)] focus:ring-[var(--accent)]",
    secondary:
      "bg-[var(--bg-surface-raised)] text-[var(--text-primary)] border border-[var(--border-subtle)] hover:bg-[var(--bg-surface-hover)] hover:border-[var(--border-strong)] shadow-sm focus:ring-[var(--text-secondary)]",
    danger:
      "bg-[var(--status-error)] text-white hover:opacity-90 shadow-sm focus:ring-[var(--status-error)]",
    ghost:
      "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)] hover:text-[var(--text-primary)] focus:ring-[var(--text-tertiary)]",
    outline:
      "bg-transparent text-[var(--accent)] border-2 border-[var(--accent)] hover:bg-[var(--accent-muted)] focus:ring-[var(--accent)]",
  };

  const classes = [
    baseStyles,
    sizes[size],
    variants[variant],
    fullWidth ? "w-full" : "",
    className,
  ].filter(Boolean).join(" ");

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : icon ? (
        <span className="mr-2">{icon}</span>
      ) : null}
      {children}
    </button>
  );
}
