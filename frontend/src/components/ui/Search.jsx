import React, { forwardRef } from "react";
import { Search as SearchIcon, X } from "lucide-react";

const Search = forwardRef(({ value, onChange, onClear, placeholder = "Search...", className = "", ...props }, ref) => {
  return (
    <div className={`relative w-full ${className}`}>
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--text-tertiary)]">
        <SearchIcon size={16} />
      </div>
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`
          w-full rounded-lg text-sm transition-all duration-200 outline-none
          bg-[var(--bg-surface-raised)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)]
          border border-transparent hover:border-[var(--border-subtle)] hover:bg-[var(--bg-surface)]
          focus:border-[var(--accent)] focus:bg-[var(--bg-surface)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--accent)_15%,transparent)]
          pl-10 pr-10 py-2.5
        `}
        {...props}
      />
      {value && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
});

Search.displayName = "Search";
export default Search;
