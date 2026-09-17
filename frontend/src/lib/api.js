/* eslint-disable @typescript-eslint/no-explicit-any */
// ContractLens — API client utility
// Wraps fetch calls to the FastAPI backend with auth headers.

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("ContractLens_token");
}

async function apiFetch(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });

  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("ContractLens_token");
      window.location.href = "/login";
    }
    const error = await response.json().catch(() => ({ detail: "Network error" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export const api = {
  // Auth
  register: (data) =>
  apiFetch("/auth/register", { method: "POST", body: JSON.stringify(data) }),

  login: (data) =>
  apiFetch("/auth/login", { method: "POST", body: JSON.stringify(data) }),

  me: () => apiFetch("/auth/me"),

  // Dashboard
  dashboardSummary: () => apiFetch("/dashboard/summary"),

  // Contracts
  listContracts: (params) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/contracts${qs ? `?${qs}` : ""}`);
  },
  getContract: (id) => apiFetch(`/contracts/${id}`),
  deleteContract: (id) => apiFetch(`/contracts/${id}`, { method: "DELETE" }),
  triggerScan: (id) =>
  apiFetch(`/contracts/${id}/scan`, { method: "POST" }),

  uploadContract: async (file) => {
    const token = getToken();
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`${API_BASE}/contracts/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData
    });
    if (!response.ok) {
      if (response.status === 401 && typeof window !== "undefined") {
        localStorage.removeItem("ContractLens_token");
        window.location.href = "/login";
      }
      throw new Error("Upload failed");
    }
    return response.json();
  },

  // Decisions
  listDecisions: (status) =>
  apiFetch(`/decisions${status ? `?status=${status}` : ""}`),
  approveDecision: (id) =>
  apiFetch(`/decisions/${id}/approve`, { method: "POST" }),
  rejectDecision: (id) =>
  apiFetch(`/decisions/${id}/reject`, { method: "POST" }),

  // Actions
  listActions: () => apiFetch("/actions"),
  getAction: (id) => apiFetch(`/actions/${id}`),
  sendAction: (id) =>
  apiFetch(`/actions/${id}/send`, { method: "POST" }),

  // MCP
  listMcpConnections: () => apiFetch("/mcp"),
  connectMcpServer: (server_type, data) =>
  apiFetch(`/mcp/${server_type}/connect`, { method: "POST", body: JSON.stringify(data) }),
  disconnectMcpServer: (server_type) =>
  apiFetch(`/mcp/${server_type}`, { method: "DELETE" }),
  updateMcpScopes: (server_type, data) =>
  apiFetch(`/mcp/${server_type}/scopes`, { method: "PATCH", body: JSON.stringify(data) }),

  // Settings
  getOrgSettings: () => apiFetch("/settings"),
  updateOrgSettings: (data) =>
  apiFetch("/settings", { method: "PUT", body: JSON.stringify(data) }),

  // Audit Log
  listAuditLogs: (params) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/audit${qs ? `?${qs}` : ""}`);
  },

  // Chat (AI Q&A)
  chat: (data) =>
  apiFetch("/chat", {
    method: "POST",
    body: JSON.stringify(data)
  }),

  // Analytics
  getOutcomeAnalytics: () => apiFetch("/analytics/outcomes"),
  getRiskTrend: (days) =>
  apiFetch(`/analytics/risk-trend${days ? `?days=${days}` : ""}`),
  getAnalyticsSummary: () => apiFetch("/analytics/summary"),

  // Notifications
  listNotifications: () => apiFetch("/notifications"),

  // Renewals Calendar
  getRenewals: () => apiFetch("/renewals"),

  // Export (direct download links — use window.open)
  exportContractsUrl: () => `${API_BASE}/export/contracts`,
  exportDecisionsUrl: () => `${API_BASE}/export/decisions`,

  // Vendor Intelligence
  getVendors: () => apiFetch("/vendors"),

  // Team Management
  listTeam: () => apiFetch("/team"),
  inviteUser: (data) =>
  apiFetch("/team/invite", { method: "POST", body: JSON.stringify(data) }),
  updateUserRole: (userId, data) =>
  apiFetch(`/team/${userId}/role`, { method: "PATCH", body: JSON.stringify(data) }),
  removeUser: (userId) =>
  apiFetch(`/team/${userId}`, { method: "DELETE" }),

  // Webhooks
  listWebhooks: () => apiFetch("/webhooks"),
  createWebhook: (data) =>
  apiFetch("/webhooks", { method: "POST", body: JSON.stringify(data) }),
  updateWebhook: (id, data) =>
  apiFetch(`/webhooks/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteWebhook: (id) =>
  apiFetch(`/webhooks/${id}`, { method: "DELETE" }),
  testWebhook: (id) =>
  apiFetch(`/webhooks/${id}/test`, { method: "POST" })
};
