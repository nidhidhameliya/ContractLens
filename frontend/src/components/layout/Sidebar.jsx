"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, FileText, Bell, Zap, Settings, Shield,
  LogOut, ChevronsLeft, ChevronsRight, Clock, MessageSquare,
  Users, Briefcase,
} from "lucide-react";
import { api } from "@/lib/api";

// Custom Activity icon (polyline)
const ActivityIcon = ({ size = 16, className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const NAV_GROUPS = [
  {
    label: "Core",
    items: [
      { href: "/",          icon: LayoutDashboard, label: "Dashboard" },
      { href: "/contracts", icon: FileText,        label: "Contracts" },
      { href: "/chat",      icon: MessageSquare,   label: "AI Chat" },
      { href: "/renewals",  icon: Clock,           label: "Renewals" },
      { href: "/vendors",   icon: Briefcase,       label: "Vendors" },
    ],
  },
  {
    label: "Governance",
    items: [
      { href: "/approvals", icon: Shield,       label: "Approvals", badge: true },
      { href: "/actions",   icon: Zap,          label: "Actions" },
      { href: "/activity",  icon: ActivityIcon, label: "Activity" },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/team",     icon: Users,    label: "Team" },
      { href: "/settings", icon: Settings, label: "Settings" },
    ],
  },
];

export default function Sidebar({ collapsed, onToggle }) {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingCount, setPendingCount] = useState(0);
  const [userInitial, setUserInitial] = useState("A");
  const [userName, setUserName] = useState("Admin");
  const [userRole, setUserRole] = useState("admin");

  useEffect(() => {
    api.dashboardSummary()
      .then((d) => setPendingCount(d.pending_approvals ?? 0))
      .catch(() => {});
    api.me()
      .then((u) => {
        setUserInitial((u.email?.[0] ?? "A").toUpperCase());
        setUserName(u.full_name || u.email?.split("@")[0] || "User");
        setUserRole(u.role ?? "user");
      })
      .catch(() => {});
  }, []);

  const logout = () => {
    localStorage.removeItem("ContractLens_token");
    router.push("/login");
  };

  return (
    <aside
      style={{
        width: collapsed ? 56 : 228,
        transition: "width 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        background: "var(--sidebar-bg)",
        borderRight: "1px solid var(--sidebar-border)",
        position: "fixed",
        left: 0,
        top: 0,
        height: "100%",
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Logo */}
      <div
        style={{
          height: 56,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: collapsed ? "0 14px" : "0 16px",
          borderBottom: "1px solid var(--sidebar-border)",
          flexShrink: 0,
          overflow: "hidden",
        }}
      >
        {/* Brand mark */}
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            background: "var(--accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Shield size={14} color="#fff" />
        </div>

        {!collapsed && (
          <div style={{ minWidth: 0, overflow: "hidden" }}>
            <p
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--sidebar-text-active)",
                letterSpacing: "-0.02em",
                lineHeight: 1,
                whiteSpace: "nowrap",
              }}
            >
              ContractLens
            </p>
            <p
              style={{
                fontSize: 10,
                color: "var(--sidebar-text)",
                marginTop: 2,
                letterSpacing: "0.04em",
                whiteSpace: "nowrap",
              }}
            >
              Contract Intelligence
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav
        className="no-scrollbar"
        style={{ flex: 1, overflowY: "auto", padding: "12px 8px" }}
      >
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.label} style={{ marginBottom: gi < NAV_GROUPS.length - 1 ? 20 : 0 }}>
            {!collapsed && (
              <p
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                  color: "var(--sidebar-text)",
                  padding: "0 10px",
                  marginBottom: 4,
                  opacity: 0.6,
                }}
              >
                {group.label}
              </p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {group.items.map(({ href, icon: Icon, label, badge }) => {
                const active =
                  pathname === href ||
                  (href !== "/" && pathname.startsWith(href));
                const showBadge = badge && pendingCount > 0;

                return (
                  <Link
                    key={href}
                    href={href}
                    title={collapsed ? label : undefined}
                    style={{
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      gap: 9,
                      padding: collapsed ? "8px 14px" : "7px 10px",
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: active ? 500 : 400,
                      color: active ? "var(--sidebar-text-active)" : "var(--sidebar-text)",
                      background: active ? "var(--sidebar-item-active)" : "transparent",
                      textDecoration: "none",
                      transition: "background 120ms ease, color 120ms ease",
                      justifyContent: collapsed ? "center" : "flex-start",
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        e.currentTarget.style.background = "var(--sidebar-item-hover)";
                        e.currentTarget.style.color = "var(--sidebar-text-active)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "var(--sidebar-text)";
                      }
                    }}
                  >
                    {/* Active left indicator */}
                    {active && (
                      <span
                        style={{
                          position: "absolute",
                          left: 0,
                          top: 6,
                          bottom: 6,
                          width: 2,
                          borderRadius: "0 2px 2px 0",
                          background: "var(--sidebar-icon-active)",
                        }}
                      />
                    )}

                    <Icon
                      size={15}
                      style={{
                        color: active ? "var(--sidebar-icon-active)" : "inherit",
                        flexShrink: 0,
                        opacity: active ? 1 : 0.7,
                      }}
                    />

                    {!collapsed && (
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {label}
                      </span>
                    )}

                    {!collapsed && showBadge && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: "1px 6px",
                          borderRadius: 99,
                          background: "var(--accent)",
                          color: "#fff",
                          lineHeight: 1.5,
                          flexShrink: 0,
                        }}
                      >
                        {pendingCount}
                      </span>
                    )}

                    {collapsed && showBadge && (
                      <span
                        style={{
                          position: "absolute",
                          top: 6,
                          right: 6,
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: "var(--accent)",
                        }}
                      />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom: Collapse toggle + User */}
      <div style={{ flexShrink: 0, borderTop: "1px solid var(--sidebar-border)" }}>
        {/* Collapse toggle */}
        <div style={{ padding: "6px 8px" }}>
          <button
            onClick={onToggle}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: 32,
              borderRadius: 6,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--sidebar-text)",
              transition: "background 120ms ease, color 120ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--sidebar-item-hover)";
              e.currentTarget.style.color = "var(--sidebar-text-active)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--sidebar-text)";
            }}
          >
            {collapsed ? <ChevronsRight size={14} /> : <ChevronsLeft size={14} />}
          </button>
        </div>

        {/* User footer */}
        <div
          style={{
            padding: collapsed ? "10px 8px" : "10px 12px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            borderTop: "1px solid var(--sidebar-border)",
            background: "rgba(0,0,0,0.15)",
          }}
        >
          {/* Avatar */}
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: "var(--accent-muted)",
              border: "1px solid var(--accent-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--accent)",
              flexShrink: 0,
            }}
          >
            {userInitial}
          </div>

          {!collapsed && (
            <>
              <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
                <p
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: "var(--sidebar-text-active)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    lineHeight: 1.2,
                  }}
                >
                  {userName}
                </p>
                <p
                  style={{
                    fontSize: 10,
                    color: "var(--sidebar-text)",
                    textTransform: "capitalize",
                    marginTop: 1,
                    lineHeight: 1,
                  }}
                >
                  {userRole}
                </p>
              </div>
              <button
                onClick={logout}
                title="Sign out"
                style={{
                  padding: 6,
                  borderRadius: 5,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--sidebar-text)",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  transition: "color 120ms ease",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "var(--status-danger)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "var(--sidebar-text)"; }}
              >
                <LogOut size={13} />
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
