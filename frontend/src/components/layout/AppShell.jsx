"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import CommandPalette from "@/components/layout/CommandPalette";
import { useTheme } from "@/components/ThemeProvider";
import { Sun, Moon } from "lucide-react";

const PUBLIC_PATHS = ["/login"];

const PAGE_META = {
  "/":           { title: "Dashboard",        description: "Real-time contract risk intelligence" },
  "/contracts":  { title: "Contracts",         description: "Monitor and manage vendor contracts" },
  "/chat":       { title: "AI Chat",           description: "Conversational contract analysis" },
  "/renewals":   { title: "Renewals",          description: "Contract renewal timeline and alerts" },
  "/vendors":    { title: "Vendors",           description: "Vendor portfolio and risk intelligence" },
  "/approvals":  { title: "Approvals",         description: "Review AI recommendations before action" },
  "/actions":    { title: "Actions",           description: "Draft execution and action audit" },
  "/activity":   { title: "Activity",          description: "Immutable system and human audit trail" },
  "/team":       { title: "Team",              description: "Manage workspace members and roles" },
  "/settings":   { title: "Settings",          description: "Configure thresholds, connections, and preferences" },
};

function LoadingScreen() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "var(--bg-canvas)" }}
      suppressHydrationWarning
    >
      <div
        className="w-7 h-7 rounded-full animate-spin"
        style={{
          border: "2px solid var(--border-default)",
          borderTopColor: "var(--accent)",
        }}
        suppressHydrationWarning
      />
    </div>
  );
}

export default function AppShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = PUBLIC_PATHS.includes(pathname);
  const [checked, setChecked] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { theme, toggleTheme } = useTheme();

  // Match dynamic sub-routes (e.g. /contracts/[id])
  const pageKey = Object.keys(PAGE_META).find((k) =>
    k !== "/" ? pathname.startsWith(k) : pathname === "/"
  );
  const pageMeta = PAGE_META[pageKey] ?? { title: "", description: "" };

  useEffect(() => {
    Promise.resolve().then(() => {
      const token = localStorage.getItem("Termora_token");
      if (!isPublic && !token) {
        router.replace("/login");
      } else {
        setChecked(true);
      }
    });
  }, [pathname, isPublic, router]);

  if (isPublic) {
    return (
      <>
        <CommandPalette />
        {children}
      </>
    );
  }

  if (!checked) {
    return <LoadingScreen />;
  }

  const sidebarWidth = sidebarCollapsed ? 56 : 228;

  return (
    <div
      suppressHydrationWarning
      style={{
        display: "flex",
        minHeight: "100vh",
        width: "100%",
        overflow: "hidden",
        background: "var(--bg-canvas)",
        color: "var(--text-primary)",
      }}
    >
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((p) => !p)}
      />
      <CommandPalette />

      <div
        className="flex flex-col min-h-screen"
        style={{
          marginLeft: sidebarWidth,
          flex: 1,
          transition: "margin-left 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        {/* Header */}
        <header
          className="sticky top-0 z-40 flex items-center justify-between shrink-0"
          style={{
            height: 56,
            padding: "0 28px",
            background: "var(--bg-surface)",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <div>
            {pageMeta.title && (
              <h1
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  letterSpacing: "-0.02em",
                  lineHeight: 1.2,
                }}
              >
                {pageMeta.title}
              </h1>
            )}
            {pageMeta.description && (
              <p
                style={{
                  fontSize: 12,
                  color: "var(--text-tertiary)",
                  marginTop: 1,
                  lineHeight: 1,
                }}
              >
                {pageMeta.description}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Search trigger */}
            <button
              onClick={() => {
                window.dispatchEvent(
                  new KeyboardEvent("keydown", { key: "k", metaKey: true })
                );
              }}
              id="command-palette-trigger"
              className="btn btn-secondary btn-sm"
              title="Search (Ctrl+K)"
              style={{ gap: 8, paddingRight: 8 }}
            >
              <Search size={13} />
              <span style={{ fontSize: 12 }}>Search</span>
              <kbd style={{ marginLeft: 4 }}>
                {typeof navigator !== "undefined" &&
                /Mac|iPod|iPhone|iPad/.test(navigator.platform)
                  ? "⌘K"
                  : "Ctrl+K"}
              </kbd>
            </button>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="btn btn-ghost btn-icon btn-sm"
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              id="theme-toggle"
            >
              {theme === "dark" ? (
                <Sun size={14} style={{ color: "var(--text-tertiary)" }} />
              ) : (
                <Moon size={14} style={{ color: "var(--text-tertiary)" }} />
              )}
            </button>
          </div>
        </header>

        {/* Main content */}
        <main
          className="flex-1"
          style={{ padding: "28px 32px" }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}