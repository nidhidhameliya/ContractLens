import React, { forwardRef } from "react";
import { ChevronDown } from "lucide-react";

const Select = forwardRef(({ className = "", children, error, ...props }, ref) => {
  return (
    <div className="relative w-full">
      <select
        ref={ref}
        className={`
          w-full appearance-none rounded-lg text-sm transition-all duration-200 outline-none
          bg-[var(--bg-surface)] text-[var(--text-primary)]
          border border-[var(--border-subtle)] hover:border-[var(--border-strong)]
          focus:border-[var(--accent)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--accent)_15%,transparent)]
          disabled:opacity-50 disabled:bg-[var(--bg-surface-raised)] disabled:cursor-not-allowed
          px-4 py-2.5 pr-10
          ${error ? "border-[var(--status-error)] focus:border-[var(--status-error)] focus:ring-[color-mix(in_srgb,var(--status-error)_15%,transparent)]" : ""}
          ${className}
        `}
        {...props}
      >
        {children}
      </select>
      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-[var(--text-tertiary)]">
        <ChevronDown size={16} />
      </div>
      {error && <p className="mt-1 text-xs text-[var(--status-error)]">{error}</p>}
    </div>
  );
});

Select.displayName = "Select";
export default Select;
