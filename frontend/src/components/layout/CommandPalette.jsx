"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search, LayoutDashboard, FileText, Bell, Zap, Settings,
  Clock, Users, MessageSquare, Briefcase,
} from "lucide-react";

const ROUTES = [
  { href: "/",          label: "Dashboard",  icon: LayoutDashboard, group: "Core" },
  { href: "/contracts", label: "Contracts",  icon: FileText,        group: "Core" },
  { href: "/chat",      label: "AI Chat",    icon: MessageSquare,   group: "Core" },
  { href: "/renewals",  label: "Renewals",   icon: Clock,           group: "Core" },
  { href: "/vendors",   label: "Vendors",    icon: Briefcase,       group: "Core" },
  { href: "/approvals", label: "Approvals",  icon: Bell,            group: "Governance" },
  { href: "/actions",   label: "Actions",    icon: Zap,             group: "Governance" },
  { href: "/team",      label: "Team",       icon: Users,           group: "System" },
  { href: "/settings",  label: "Settings",   icon: Settings,        group: "System" },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const router = useRouter();

  const filtered = ROUTES.filter(
    (r) =>
      r.label.toLowerCase().includes(query.toLowerCase()) ||
      r.group.toLowerCase().includes(query.toLowerCase())
  );

  const navigate = useCallback(
    (href) => {
      setOpen(false);
      setQuery("");
      router.push(href);
    },
    [router]
  );

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => {
          if (!prev) { setQuery(""); setSelectedIndex(0); }
          return !prev;
        });
      }
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
        setSelectedIndex(0);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      navigate(filtered[selectedIndex].href);
    }
  };

  if (!open) return null;

  // Group filtered results
  const groups = filtered.reduce((acc, route) => {
    if (!acc[route.group]) acc[route.group] = [];
    acc[route.group].push(route);
    return acc;
  }, {});

  let globalIdx = 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[18vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 animate-fade-in"
        style={{ background: "rgba(9,11,17,0.5)", backdropFilter: "blur(4px)" }}
        onClick={() => setOpen(false)}
      />

      {/* Palette */}
      <div
        className="relative w-full max-w-[480px] rounded-xl overflow-hidden animate-slide-up"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          boxShadow: "0 20px 60px -8px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.05)",
        }}
      >
        {/* Search input */}
        <div
          className="flex items-center gap-3 px-4"
          style={{
            height: 52,
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <Search size={16} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Search pages..."
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              fontSize: 14,
              color: "var(--text-primary)",
              fontFamily: "var(--font-sans)",
            }}
          />
          <kbd>ESC</kbd>
        </div>

        {/* Results */}
        <div className="p-1.5 max-h-72 overflow-y-auto">
          {filtered.length === 0 ? (
            <p
              className="text-sm text-center py-10"
              style={{ color: "var(--text-tertiary)" }}
            >
              No results found
            </p>
          ) : (
            Object.entries(groups).map(([groupName, routes]) => (
              <div key={groupName}>
                <p
                  className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-disabled)" }}
                >
                  {groupName}
                </p>
                {routes.map((route) => {
                  const idx = globalIdx++;
                  const isSelected = idx === selectedIndex;
                  const Icon = route.icon;
                  return (
                    <button
                      key={route.href}
                      onClick={() => navigate(route.href)}
                      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-colors"
                      style={{
                        background: isSelected ? "var(--bg-hover)" : "transparent",
                        color: isSelected ? "var(--text-primary)" : "var(--text-secondary)",
                      }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                    >
                      <Icon
                        size={14}
                        style={{ color: isSelected ? "var(--accent)" : "var(--text-tertiary)" }}
                      />
                      <span className="flex-1 text-left font-medium">{route.label}</span>
                      {isSelected && (
                        <span
                          className="text-[10px] font-medium"
                          style={{ color: "var(--text-disabled)" }}
                        >
                          ↵ Open
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center gap-4 px-4 py-2.5 text-[11px]"
          style={{
            borderTop: "1px solid var(--border-subtle)",
            color: "var(--text-disabled)",
            background: "var(--bg-surface-raised)",
          }}
        >
          <span className="flex items-center gap-1.5"><kbd>↑↓</kbd> Navigate</span>
          <span className="flex items-center gap-1.5"><kbd>↵</kbd> Open</span>
          <span className="flex items-center gap-1.5"><kbd>Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  );
}