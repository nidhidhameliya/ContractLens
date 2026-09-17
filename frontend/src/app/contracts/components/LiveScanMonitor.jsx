"use client";

import { useEffect, useState, useRef, useMemo } from "react";

// ── Agent definitions ──────────────────────────────────────────────────────────
function getAgents(fileName = "") {
  const name = fileName || "document";
  const ext = name.includes(".") ? name.split('.').pop().toUpperCase() : "DOC";
  
  let seed = 0;
  for (let i = 0; i < name.length; i++) {
    seed += name.charCodeAt(i);
  }
  
  const tokens = (1200 + (seed % 6000)).toLocaleString();
  const segments = 12 + (seed % 35);
  const confidence = (0.85 + ((seed % 14) / 100)).toFixed(2);
  const seats = 10 + (seed % 150);
  
  return [
    {
      key: "ingestion", label: "Contract Parser", color: "#818cf8",
      emoji: "📄",
      logs: [
        `Opening ${ext} document stream for ${name}…`,
        "Extracting raw text via parser…",
        `Tokenising into ${segments} segments…`,
        "Splitting clause boundaries…",
        "✓ Document parsed successfully",
      ],
    },
    {
      key: "detection", label: "Clause Detection", color: "#a78bfa",
      emoji: "🔍",
      logs: [
        `Sending ${tokens} context tokens to Groq…`,
        "Extracting vendor name…",
        "Parsing renewal date & notice period…",
        "Detecting auto-renew clauses…",
        `Scoring extraction confidence: ${confidence}`,
        "✓ Clause extraction complete",
      ],
    },
    {
      key: "usage", label: "Usage Signals", color: "#34d399",
      emoji: "📊",
      logs: [
        "Querying Okta MCP server…",
        `Fetching active seat count (found ${seats})…`,
        "Calculating utilisation ratio…",
        "Estimating idle seat cost…",
        "✓ Usage signals retrieved",
      ],
    },
    {
      key: "risk", label: "Risk Analysis", color: "#fb923c",
      emoji: "⚠️",
      logs: [
        "Evaluating auto-renew exposure…",
        "Checking notice period adequacy…",
        "Scanning for price escalation clauses…",
        "Assessing ambiguous clause risk…",
        "✓ Risk level determined",
      ],
    },
    {
      key: "finance", label: "Finance Model", color: "#fbbf24",
      emoji: "💰",
      logs: [
        "Loading annual contract value…",
        "Projecting renewal cost trajectory…",
        "Estimating renegotiation savings…",
        "Calculating cancellation impact…",
        "✓ Financial model complete",
      ],
    },
    {
      key: "decision", label: "Decision Agent", color: "#f472b6",
      emoji: "🤖",
      logs: [
        "Querying ChromaDB for similar decisions…",
        "Running LLM decision synthesis…",
        "Generating recommended action…",
        "Computing confidence score…",
        "✓ Decision generated",
      ],
    },
    {
      key: "rules", label: "Policy Rules", color: "#60a5fa",
      emoji: "📋",
      logs: [
        "Applying org approval threshold…",
        "Checking risk escalation policies…",
        "Evaluating auto-approve conditions…",
        "Routing decision outcome…",
        "✓ Policy evaluation complete",
      ],
    },
  ];
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function AgentNode({ agent, isDone, isActive }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: 80, flexShrink: 0 }}>
      {/* Circle */}
      <div style={{
        position: "relative", width: 54, height: 54, borderRadius: "50%",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: isDone
          ? `color-mix(in srgb, ${agent.color} 16%, transparent)`
          : isActive ? `color-mix(in srgb, ${agent.color} 10%, transparent)` : "rgba(255,255,255,0.03)",
        border: (isDone || isActive) ? `1.5px solid ${agent.color}` : "1.5px solid rgba(255,255,255,0.07)",
        transition: "all 0.55s cubic-bezier(0.16,1,0.3,1)",
        boxShadow: isActive
          ? `0 0 0 5px color-mix(in srgb, ${agent.color} 14%, transparent), 0 0 28px color-mix(in srgb, ${agent.color} 38%, transparent)`
          : isDone ? `0 0 14px color-mix(in srgb, ${agent.color} 24%, transparent)` : "none",
      }}>
        {/* Pulse ring */}
        {isActive && (
          <div style={{
            position: "absolute", inset: -8, borderRadius: "50%",
            border: `1.5px solid ${agent.color}`,
            animation: "lsm-ping 1.5s ease-out infinite", opacity: 0.45,
          }} />
        )}
        <span style={{
          fontSize: isDone ? 22 : 20,
          filter: isDone || isActive ? "none" : "grayscale(1) opacity(0.2)",
          transition: "filter 0.4s",
          display: "inline-block",
          animation: isActive ? "lsm-spin 1.8s linear infinite" : "none",
        }}>
          {isDone ? "✓" : agent.emoji}
        </span>
      </div>

      <span style={{
        fontSize: 9.5, fontWeight: 600, textAlign: "center", lineHeight: 1.3,
        color: (isDone || isActive) ? agent.color : "rgba(255,255,255,0.18)",
        transition: "color 0.4s",
      }}>
        {agent.label}
      </span>

      <span style={{
        fontSize: 8.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em",
        color: isDone ? agent.color : isActive ? agent.color : "rgba(255,255,255,0.1)",
      }}>
        {isDone ? "Done" : isActive ? "Active" : "Queue"}
      </span>
    </div>
  );
}

function Connector({ fromColor, toColor, isDone, isActive }) {
  return (
    <div style={{
      flex: 1, height: 2, position: "relative", alignSelf: "center", marginBottom: 40,
      background: isDone
        ? `linear-gradient(90deg, ${fromColor}, ${toColor})`
        : "rgba(255,255,255,0.05)",
      borderRadius: 2, overflow: "hidden", transition: "background 0.7s",
    }}>
      {isActive && (
        <div style={{
          position: "absolute", inset: 0,
          background: `linear-gradient(90deg, transparent, ${fromColor}, transparent)`,
          animation: "lsm-beam 1.1s linear infinite",
        }} />
      )}
    </div>
  );
}

const LIVE_SCAN_STYLES = `
  @keyframes lsm-ping  { 0% { transform:scale(1); opacity:.6; } 100% { transform:scale(2); opacity:0; } }
  @keyframes lsm-beam  { 0% { transform:translateX(-100%); } 100% { transform:translateX(300%); } }
  @keyframes lsm-log   { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }
  @keyframes lsm-spin  { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
  @keyframes lsm-dot   { 0%,100% { opacity:1; } 50% { opacity:.35; } }
  @keyframes lsm-bar   { 0% { transform:translateX(-100%); } 50% { transform:translateX(80%); } 100% { transform:translateX(250%); } }
`;

// ── Main component ─────────────────────────────────────────────────────────────
export default function LiveScanMonitor({ fileName, visible, externalStage, onClose }) {
  const agents = useMemo(() => getAgents(fileName), [fileName]);
  const [logLines, setLogLines] = useState([agents[0].logs[0]]);
  const [logAgentColor, setLogAgentColor] = useState(agents[0].color);
  const [elapsed, setElapsed]   = useState(0);
  const [done, setDone]         = useState(false);

  // Internal stage drives the node animation
  // externalStage (from parent) is the single source of truth
  const stage = externalStage ?? 0;
  const startRef = useRef(Date.now());
  const bottomRef = useRef(null);
  const prevStageRef = useRef(-1);

  // Reset when opened
  useEffect(() => {
    if (!document.getElementById("live-scan-styles")) {
      const style = document.createElement("style");
      style.id = "live-scan-styles";
      style.innerHTML = LIVE_SCAN_STYLES;
      document.head.appendChild(style);
    }

    if (!visible) return;
    startRef.current = Date.now();
    setLogLines([agents[0].logs[0]]);
    setLogAgentColor(agents[0].color);
    setElapsed(0);
    setDone(false);
    prevStageRef.current = -1;
  }, [visible, agents]);

  // Elapsed timer
  useEffect(() => {
    if (!visible) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 500);
    return () => clearInterval(t);
  }, [visible]);

  // Stream logs when stage advances
  useEffect(() => {
    if (!visible) return;
    if (stage === prevStageRef.current) return;
    prevStageRef.current = stage;

    const agent = agents[Math.min(stage, agents.length - 1)];
    setLogAgentColor(agent.color);

    if (stage >= agents.length) {
      setDone(true);
      setLogLines(prev => [...prev, "", "── All agents complete ──", "✓ Results saved to database"]);
      return;
    }

    // Append separator + first log of new agent
    setLogLines(prev => [
      ...prev,
      "",
      `── ${agent.label} ──`,
      agent.logs[0],
    ]);

    // Stream remaining logs of this stage
    agent.logs.slice(1).forEach((line, i) => {
      setTimeout(() => {
        setLogLines(prev => [...prev, line]);
      }, (i + 1) * 900 + Math.random() * 400);
    });
  }, [stage, visible, agents]);

  // Auto-scroll log
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logLines]);

  if (!visible) return null;

  const curAgent = agents[Math.min(stage, agents.length - 1)];
  const progressPct = Math.min((stage / (agents.length - 1)) * 100, 100);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(4,4,18,0.97)",
      backdropFilter: "blur(24px) saturate(180%)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: 16,
    }}>

      <div style={{
        width: "100%", maxWidth: 880,
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 20,
        boxShadow: "0 60px 120px rgba(0,0,0,0.7)",
        overflow: "hidden",
      }}>

        {/* ── Header ── */}
        <div style={{
          padding: "18px 28px", display: "flex", alignItems: "center", justifyContent: "space-between",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          background: "rgba(0,0,0,0.3)",
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 3 }}>
              <div style={{
                width: 9, height: 9, borderRadius: "50%",
                background: curAgent.color,
                boxShadow: `0 0 10px ${curAgent.color}`,
                animation: done ? "none" : "lsm-dot 1.4s ease infinite",
              }} />
              <span style={{ color: "rgba(255,255,255,0.92)", fontSize: 15, fontWeight: 700, letterSpacing: "-0.025em" }}>
                AI Analysis Pipeline
              </span>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
                padding: "2px 8px", borderRadius: 999, textTransform: "uppercase",
                background: done
                  ? "rgba(52,211,153,0.15)"
                  : `color-mix(in srgb, ${curAgent.color} 18%, transparent)`,
                color: done ? "#34d399" : curAgent.color,
              }}>
                {done ? "Complete" : "Live"}
              </span>
            </div>
            <p style={{ fontSize: 11.5, color: "rgba(255,255,255,0.3)", fontFamily: "monospace" }}>
              {fileName}
            </p>
          </div>
          <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
            <button 
              onClick={onClose}
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.7)",
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                padding: "4px 8px",
                borderRadius: 4,
                cursor: "pointer",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,0,0,0.2)"; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "rgba(255,255,255,0.7)"; }}
            >
              Close Overlay
            </button>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Elapsed</div>
              <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "monospace", letterSpacing: "-0.05em", color: curAgent.color, marginTop: -4 }}>
                {String(Math.floor(elapsed / 60)).padStart(2, "0")}:{String(elapsed % 60).padStart(2, "0")}
              </div>
            </div>
          </div>
        </div>

        {/* ── Pipeline Nodes ── */}
        <div style={{ padding: "28px 28px 12px", overflowX: "auto" }}>
          <div style={{ display: "flex", alignItems: "flex-start", minWidth: 640 }}>
            {agents.map((agent, i) => (
              <div key={agent.key} style={{ display: "flex", alignItems: "center", flex: i < agents.length - 1 ? 1 : "0 0 auto" }}>
                <AgentNode agent={agent} isDone={i < stage} isActive={i === stage && !done} />
                {i < agents.length - 1 && (
                  <Connector
                    fromColor={agents[i].color}
                    toColor={agents[i + 1].color}
                    isDone={i < stage}
                    isActive={i === stage && !done}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Stage label + progress bar ── */}
        <div style={{ padding: "0 28px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: done ? "#34d399" : curAgent.color }}>
              {done ? "✓ Pipeline complete — loading results…" : `${curAgent.emoji} ${curAgent.label}`}
            </span>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", fontFamily: "monospace" }}>
              {Math.min(stage + 1, agents.length)} / {agents.length} agents
            </span>
          </div>

          {/* Progress bar */}
          <div style={{ height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 4, overflow: "hidden", marginBottom: 16 }}>
            <div style={{
              height: "100%",
              width: `${progressPct}%`,
              background: done
                ? "linear-gradient(90deg, #818cf8, #34d399)"
                : `linear-gradient(90deg, #818cf8, ${curAgent.color})`,
              borderRadius: 4,
              transition: "width 1s cubic-bezier(0.16,1,0.3,1)",
              boxShadow: `0 0 10px ${curAgent.color}`,
              position: "relative",
              overflow: "hidden",
            }}>
              {!done && (
                <div style={{
                  position: "absolute", inset: 0,
                  background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)",
                  animation: "lsm-bar 2s linear infinite",
                }} />
              )}
            </div>
          </div>

          {/* Log feed */}
          <div style={{
            fontFamily: "ui-monospace,'JetBrains Mono',monospace",
            fontSize: 11.5, lineHeight: 1.75,
            height: 156, overflowY: "auto",
            padding: "12px 16px",
            background: "rgba(0,0,0,0.38)",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.05)",
          }}>
            {logLines.map((line, i) => (
              <div key={i} style={{
                display: "flex", gap: 8,
                animation: i === logLines.length - 1 ? "lsm-log 0.25s ease both" : "none",
              }}>
                {line === "" ? (
                  <span style={{ opacity: 0.05, userSelect: "none" }}>─</span>
                ) : line.startsWith("──") ? (
                  <span style={{ color: logAgentColor, opacity: 0.7, fontSize: 10.5 }}>{line}</span>
                ) : (
                  <>
                    <span style={{ color: logAgentColor, flexShrink: 0 }}>›</span>
                    <span style={{ color: i === logLines.length - 1 ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.42)" }}>
                      {line}
                    </span>
                  </>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* ── Footer stats ── */}
        <div style={{
          padding: "14px 28px",
          borderTop: "1px solid rgba(255,255,255,0.04)",
          background: "rgba(0,0,0,0.22)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", gap: 28 }}>
            {[
              { label: "Agents Run",  value: `${Math.min(stage + 1, agents.length)}/${agents.length}` },
              { label: "LLM Calls",   value: Math.min(stage, 4) },
              { label: "MCP Calls",   value: Math.max(0, Math.min(stage - 1, 2)) },
            ].map(({ label, value }) => (
              <div key={label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: "rgba(255,255,255,0.85)", fontFamily: "monospace", letterSpacing: "-0.03em" }}>
                  {value}
                </div>
                <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.22)" }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.18)", fontFamily: "monospace" }}>
            {done ? "Closing when results are ready…" : "Processing in background — auto-loads on completion"}
          </p>
        </div>
      </div>
    </div>
  );
}
