"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Users, Plus, Trash2, Shield, Eye, UserCheck, X, AlertTriangle, Loader2 } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";

const ROLE_CONFIG = {
  admin:  { label: "Admin",  icon: Shield,     color: "var(--status-danger)" },
  user:   { label: "Member", icon: UserCheck,  color: "var(--accent)" },
  viewer: { label: "Viewer", icon: Eye,        color: "var(--text-secondary)" },
};

function SkeletonRow() {
  return <div className="skeleton" style={{ height: 52, borderRadius: 6 }} />;
}

export default function TeamPage() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", full_name: "", role: "user" });
  const [inviteResult, setInviteResult] = useState(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [teamData, meData] = await Promise.all([api.listTeam(), api.me()]);
      setMembers(teamData.members ?? []);
      setMe(meData);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { Promise.resolve().then(load); }, []);

  const handleInvite = async () => {
    setInviteLoading(true);
    try {
      const res = await api.inviteUser(inviteForm);
      setInviteResult(res);
      await load();
    } catch (e) {
      setInviteResult({ error: e.message });
    } finally { setInviteLoading(false); }
  };

  const handleRoleChange = async (userId, role) => {
    setActionLoading(userId);
    try { await api.updateUserRole(userId, { role }); await load(); }
    finally { setActionLoading(null); }
  };

  const handleRemove = async (userId) => {
    if (!confirm("Remove this user from the org?")) return;
    setActionLoading(userId);
    try { await api.removeUser(userId); await load(); }
    finally { setActionLoading(null); }
  };

  const isAdmin = me?.role === "admin";

  return (
    <div className="w-full max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 animate-fade-in">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.03em", color: "var(--text-primary)", lineHeight: 1.1 }}>
            Team
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-tertiary)" }}>
            {members.length} member{members.length !== 1 ? "s" : ""} in your workspace
          </p>
        </div>
        {isAdmin && (
          <Button
            onClick={() => { setShowInvite(true); setInviteResult(null); }}
            className="btn btn-primary btn-sm"
          >
            <Plus size={13} /> Invite Member
          </Button>
        )}
      </div>

      {/* Invite panel */}
      {showInvite && (
        <div className="surface-card p-5 mb-5 animate-slide-down">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Invite New Member</h2>
            <Button
              onClick={() => setShowInvite(false)}
              className="btn btn-ghost btn-icon btn-sm"
            >
              <X size={14} style={{ color: "var(--text-tertiary)" }} />
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <Input
              placeholder="Email address"
              type="email"
              value={inviteForm.email}
              onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
              className="input-field col-span-2"
            />
            <Input
              placeholder="Full name (optional)"
              value={inviteForm.full_name}
              onChange={(e) => setInviteForm((f) => ({ ...f, full_name: e.target.value }))}
              className="input-field"
            />
            <Select
              value={inviteForm.role}
              onChange={(e) => setInviteForm((f) => ({ ...f, role: e.target.value }))}
              className="input-field"
            >
              <option value="admin">Admin</option>
              <option value="user">Member</option>
              <option value="viewer">Viewer</option>
            </Select>
          </div>

          {inviteResult && (
            <div
              className="flex items-start gap-2.5 p-3 rounded-lg text-sm mb-3"
              style={{
                background: inviteResult.error ? "var(--status-danger-muted)" : "var(--status-success-muted)",
                border: `1px solid ${inviteResult.error ? "var(--status-danger-border)" : "var(--status-success-border)"}`,
                color: inviteResult.error ? "var(--status-danger-text)" : "var(--status-success-text)",
              }}
            >
              {inviteResult.error ? (
                `Error: ${inviteResult.error}`
              ) : (
                <>
                  User created · Temp password:{" "}
                  <code
                    className="font-mono px-1.5 py-0.5 rounded text-xs ml-1"
                    style={{
                      background: "var(--bg-surface)",
                      border: "1px solid var(--status-success-border)",
                      color: "var(--status-success-text)",
                    }}
                  >
                    {inviteResult.temp_password}
                  </code>
                </>
              )}
            </div>
          )}

          <Button onClick={handleInvite}
            disabled={!inviteForm.email || inviteLoading}
            variant="primary" size="sm"
          >
            {inviteLoading ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            {inviteLoading ? "Inviting…" : "Send Invite"}
          </Button>
        </div>
      )}

      {/* Main content */}
      <div className="surface-card animate-slide-up delay-100 overflow-hidden">
        {/* Header */}
        <div
          className="grid items-center px-5 py-3"
          style={{
            gridTemplateColumns: "2fr 1fr 1fr auto",
            gap: 12,
            borderBottom: "1px solid var(--border-subtle)",
            background: "var(--bg-surface-raised)",
          }}
        >
          {["Member", "Role", "Joined", isAdmin ? "Actions" : ""].map((h, i) => (
            <span key={i} className="data-table-header" style={{ textAlign: i >= 2 ? "right" : undefined }}>
              {h}
            </span>
          ))}
        </div>

        {loading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3].map((i) => <SkeletonRow key={i} />)}
          </div>
        ) : (
          <div>
            {members.map((m, idx) => {
              const rCfg = ROLE_CONFIG[m.role] ?? ROLE_CONFIG.viewer;
              const RIcon = rCfg.icon;
              const isMe = m.id === me?.id;
              return (
                <div
                  key={m.id}
                  className="grid items-center px-5 py-4"
                  style={{
                    gridTemplateColumns: "2fr 1fr 1fr auto",
                    gap: 12,
                    borderBottom: idx < members.length - 1 ? "1px solid var(--border-subtle)" : "none",
                    transition: "background var(--transition-base)",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-hover)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  {/* Avatar + name */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0"
                      style={{
                        background: "var(--accent-muted)",
                        color: "var(--accent)",
                        border: "1px solid var(--accent-border)",
                      }}
                    >
                      {(m.full_name?.[0] ?? m.email[0]).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                        {m.full_name || m.email.split("@")[0]}
                        {isMe && (
                          <span
                            className="ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded"
                            style={{
                              background: "var(--accent-muted)",
                              color: "var(--accent)",
                              border: "1px solid var(--accent-border)",
                            }}
                          >
                            You
                          </span>
                        )}
                      </p>
                      <p className="text-xs truncate mt-0.5" style={{ color: "var(--text-tertiary)" }}>{m.email}</p>
                    </div>
                  </div>

                  {/* Role */}
                  <div className="flex items-center gap-1.5">
                    <RIcon size={13} style={{ color: rCfg.color, flexShrink: 0 }} />
                    <span className="text-xs font-medium" style={{ color: rCfg.color }}>
                      {rCfg.label}
                    </span>
                  </div>

                  {/* Joined */}
                  <p className="text-xs text-right" style={{ color: "var(--text-tertiary)" }}>
                    {m.created_at
                      ? new Date(m.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })
                      : "—"}
                  </p>

                  {/* Admin actions */}
                  {isAdmin && (
                    <div className="flex items-center justify-end gap-2">
                      {!isMe ? (
                        <>
                          <Select
                            value={m.role}
                            onChange={(e) => handleRoleChange(m.id, e.target.value)}
                            disabled={actionLoading === m.id}
                            className="input-field"
                            style={{ width: "auto", minWidth: 100 }}
                          >
                            <option value="admin">Admin</option>
                            <option value="user">Member</option>
                            <option value="viewer">Viewer</option>
                          </Select>
                          <Button
                            onClick={() => handleRemove(m.id)}
                            disabled={actionLoading === m.id}
                            className="btn btn-ghost btn-icon btn-sm"
                            title="Remove member"
                            style={{ color: "var(--status-danger)" }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--status-danger-muted)"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                          >
                            {actionLoading === m.id
                              ? <Loader2 size={13} className="animate-spin" />
                              : <Trash2 size={13} />
                            }
                          </Button>
                        </>
                      ) : (
                        <span className="text-xs" style={{ color: "var(--text-disabled)" }}>—</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {!isAdmin && !loading && (
        <div
          className="flex items-center gap-2 justify-center mt-5 py-3 rounded-lg text-sm"
          style={{
            background: "var(--status-warning-muted)",
            border: "1px solid var(--status-warning-border)",
            color: "var(--status-warning-text)",
          }}
        >
          <AlertTriangle size={14} style={{ flexShrink: 0 }} />
          Only admins can invite or remove members.
        </div>
      )}
    </div>
  );
}