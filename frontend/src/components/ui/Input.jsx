import React, { forwardRef } from "react";

const Input = forwardRef(({ 
  className = "", 
  iconLeft, 
  iconRight, 
  error, 
  ...props 
}, ref) => {
  return (
    <div className="relative w-full">
      {iconLeft && (
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--text-tertiary)]">
          {iconLeft}
        </div>
      )}
      <input
        ref={ref}
        className={`
          w-full rounded-lg text-sm transition-all duration-200 outline-none
          bg-[var(--bg-surface)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)]
          border border-[var(--border-subtle)] hover:border-[var(--border-strong)]
          focus:border-[var(--accent)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--accent)_15%,transparent)]
          disabled:opacity-50 disabled:bg-[var(--bg-surface-raised)] disabled:cursor-not-allowed
          ${iconLeft ? "pl-10" : "px-4"}
          ${iconRight ? "pr-10" : "py-2.5"}
          ${error ? "border-[var(--status-error)] focus:border-[var(--status-error)] focus:ring-[color-mix(in_srgb,var(--status-error)_15%,transparent)]" : ""}
          ${className}
        `}
        {...props}
      />
      {iconRight && (
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-[var(--text-tertiary)]">
          {iconRight}
        </div>
      )}
      {error && <p className="mt-1 text-xs text-[var(--status-error)]">{error}</p>}
    </div>
  );
});

Input.displayName = "Input";
export default Input;
