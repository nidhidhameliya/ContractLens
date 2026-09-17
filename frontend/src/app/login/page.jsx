"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Shield, Mail, Lock, User, Building2, Loader2, Eye, EyeOff, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState("login");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    org_name: "",
    full_name: "",
    email: "",
    password: "",
  });

  useEffect(() => {
    if (localStorage.getItem("ContractLens_token")) {
      router.replace("/");
    }
  }, [router]);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      let token;
      if (mode === "register") {
        const res = await api.register({
          org_name: form.org_name,
          email: form.email,
          password: form.password,
          full_name: form.full_name,
        });
        token = res.access_token;
      } else {
        const res = await api.login({ email: form.email, password: form.password });
        token = res.access_token;
      }
      localStorage.setItem("ContractLens_token", token);
      router.push("/");
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "var(--bg-canvas)" }}
    >
      <div className="w-full max-w-[380px]">

        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
            style={{ background: "var(--accent)", boxShadow: "0 4px 16px rgba(79,70,229,0.25)" }}
          >
            <Shield size={22} color="#fff" />
          </div>
          <h1
            className="text-xl font-semibold"
            style={{ color: "var(--text-primary)", letterSpacing: "-0.025em" }}
          >
            ContractLens
          </h1>
          <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
            AI Contract Risk Intelligence
          </p>
        </div>

        {/* Card */}
        <div className="surface-card-raised p-7">

          {/* Mode toggle */}
          <div
            className="flex p-1 rounded-lg mb-6"
            style={{
              background: "var(--bg-surface-raised)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            {["login", "register"].map((m) => (
              <Button
                key={m}
                onClick={() => { setMode(m); setError(null); }}
                className="flex-1 py-2 rounded-md text-sm font-medium transition-all"
                style={{
                  background: mode === m ? "var(--bg-surface)" : "transparent",
                  color: mode === m ? "var(--text-primary)" : "var(--text-tertiary)",
                  border: mode === m ? "1px solid var(--border-subtle)" : "1px solid transparent",
                  boxShadow: mode === m ? "var(--shadow-sm)" : "none",
                }}
              >
                {m === "login" ? "Sign In" : "Register"}
              </Button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === "register" && (
              <>
                <div>
                  <label
                    className="block text-xs font-medium mb-1.5"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Organization
                  </label>
                  <div className="relative">
                    <Building2
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2"
                      style={{ color: "var(--text-disabled)" }}
                    />
                    <Input required
                      value={form.org_name}
                      onChange={set("org_name")}
                      placeholder="Acme Corp"
                      
                      style={{ paddingLeft: 34 }}
                    />
                  </div>
                </div>
                <div>
                  <label
                    className="block text-xs font-medium mb-1.5"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Full Name
                  </label>
                  <div className="relative">
                    <User
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2"
                      style={{ color: "var(--text-disabled)" }}
                    />
                    <Input value={form.full_name}
                      onChange={set("full_name")}
                      placeholder="Jane Smith"
                      
                      style={{ paddingLeft: 34 }}
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: "var(--text-secondary)" }}
              >
                Email
              </label>
              <div className="relative">
                <Mail
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--text-disabled)" }}
                />
                <Input required
                  type="email"
                  value={form.email}
                  onChange={set("email")}
                  placeholder="you@company.com"
                  
                  style={{ paddingLeft: 34 }}
                />
              </div>
            </div>

            <div>
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: "var(--text-secondary)" }}
              >
                Password
              </label>
              <div className="relative">
                <Lock
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--text-disabled)" }}
                />
                <Input required
                  type={showPass ? "text" : "password"}
                  value={form.password}
                  onChange={set("password")}
                  placeholder="••••••••"
                  
                  style={{ paddingLeft: 34, paddingRight: 36 }}
                />
                <Button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-disabled)",
                    padding: 0,
                    display: "flex",
                  }}
                >
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </Button>
              </div>
            </div>

            {error && (
              <div
                className="flex items-start gap-2.5 p-3 rounded-lg text-sm"
                style={{
                  background: "var(--status-danger-muted)",
                  border: "1px solid var(--status-danger-border)",
                  color: "var(--status-danger-text)",
                }}
              >
                <AlertCircle size={14} style={{ marginTop: 1, flexShrink: 0 }} />
                {error}
              </div>
            )}

            <Button type="submit"
              disabled={loading}
              variant="primary" size="lg"
              style={{ width: "100%", height: 40, marginTop: 8 }}
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading
                ? "Authenticating..."
                : mode === "login"
                ? "Sign In"
                : "Create Account"}
            </Button>
          </form>

          {/* Demo credentials */}
          <div
            className="mt-6 pt-5 flex flex-col items-center gap-3"
            style={{ borderTop: "1px solid var(--border-subtle)" }}
          >
            <p className="text-[11px]" style={{ color: "var(--text-disabled)" }}>
              Demo credentials
            </p>
            <div className="flex gap-4">
              <Button
                type="button"
                onClick={() => {
                  setForm({ org_name: "Demo Corp", full_name: "Admin", email: "admin@demo.com", password: "secret123" });
                  setMode("login");
                  setError(null);
                }}
                className="text-xs font-medium"
                style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}
              >
                Demo Login
              </Button>
              <span style={{ color: "var(--border-default)" }}>·</span>
              <Button
                type="button"
                onClick={() => {
                  setForm({ org_name: "Demo Corp", full_name: "Admin", email: "admin@demo.com", password: "secret123" });
                  setMode("register");
                  setError(null);
                }}
                className="text-xs font-medium"
                style={{ color: "var(--text-tertiary)", background: "none", border: "none", cursor: "pointer" }}
              >
                Demo Register
              </Button>
            </div>
          </div>
        </div>

        <p
          className="text-center text-[11px] mt-5"
          style={{ color: "var(--text-disabled)" }}
        >
          ContractLens · Contract Intelligence · MCP-powered
        </p>
      </div>
    </div>
  );
}
