# Termora
## High-Level Design (HLD) & Low-Level Design (LLD)
### v2 — Updated with MCP (Model Context Protocol) Connector Architecture

---

# PART A — HIGH-LEVEL DESIGN (HLD)

## A.1 Purpose

This document defines the system architecture for **Termora**, an AI agent pipeline that scans a company's contracts, extracts renewal/pricing risk, cross-references usage data, and recommends (with human approval) actions to reduce wasted SaaS/vendor spend — then verifies whether those actions worked.

This revision updates the connector layer to use **MCP (Model Context Protocol) servers** for all external tool access (Drive, Gmail, Slack, Okta) instead of hand-written API clients, per architectural decision ADR-001 (see A.8).

## A.2 System Context

```text
                    ┌─────────────────────────────────────┐
                    │           EXTERNAL SYSTEMS           │
                    │                                       │
                    │  Google Drive   Gmail   Okta/SSO      │
                    │  (contracts)   (attach) (usage data)  │
                    └───────────────┬───────────────────────┘
                                    │
                    ┌───────────────▼───────────────────────┐
                    │            MCP SERVERS                │
                    │  Drive MCP · Gmail MCP · Slack MCP ·   │
                    │  Okta MCP (standardized tool interface)│
                    └───────────────┬───────────────────────┘
                                    │  (MCP protocol - tool calls)
                                    ▼
                    ┌─────────────────────────────────────┐
                    │            Termora                  │
                    │                                       │
                    │   Ingestion → Agents → Decision →     │
                    │   Human Approval → Action → Verify    │
                    └───────────────┬───────────────────────┘
                                    │
                    ┌───────────────┴───────────────────────┐
                    ▼                                        ▼
              Slack MCP Server                        Next.js Dashboard
              (notifications,                         (risk queue, approvals,
               draft actions)                          savings tracked)
```

## A.3 Architectural Style

- **Modular monolith for MVP** (single FastAPI service, logically separated modules), not microservices — matches the "don't over-engineer the first version" principle. Split into services only when a specific module (e.g., document parsing) needs independent scaling.
- **Agent orchestration via LangGraph**, running as a stateful graph inside the FastAPI backend, not a separate orchestration service.
- **Tool access via MCP** — every external system (Drive, Gmail, Slack, Okta) is reached through an MCP server rather than a bespoke API client. LangGraph nodes call MCP tools using the standard MCP client interface.
- **Event/scan cadence is periodic (daily/weekly), not streaming** — contracts don't change every second, so this avoids Kafka/streaming infrastructure entirely.

## A.4 High-Level Components

| Component | Responsibility |
|---|---|
| **MCP Client Layer** | Manages connections to configured MCP servers per organization; handles auth/session lifecycle for each connector. |
| **MCP Servers (Drive, Gmail, Slack, Okta)** | Standardized tool interfaces exposing operations like `list_files`, `read_file`, `search_emails`, `post_message`, `get_user_activity` to the agent layer. Drive/Gmail/Slack can use existing community or first-party MCP servers; Okta MCP server may be custom-built if no maintained one exists at build time. |
| **Ingestion Service** | Uses MCP Drive/Gmail tools to discover and pull contract files; normalizes to text, dedupes, stores raw + parsed versions. |
| **Agent Orchestrator (LangGraph)** | Runs the multi-agent graph per contract: Detection → Risk → Finance → Decision → Action. Agents call MCP tools where external data/actions are needed. |
| **Agent Pool** | Detection Agent, Risk Agent, Finance Agent, Decision Agent, Action Agent (see Part B for full specs). |
| **Decision Engine (deterministic layer)** | Validates agent outputs against business rules (e.g., dollar thresholds requiring approval) before anything reaches a human or gets executed. Lives in plain Python — never inside an MCP tool or LLM prompt. |
| **Approval & Notification Service** | Routes recommended actions to Slack (via Slack MCP server)/email/dashboard for human approval; tracks approval state. |
| **Action Executor** | Sends approved emails, creates tasks, posts Slack messages via MCP tool calls — only after explicit approval. |
| **Verification Service** | Re-checks billing/usage data (via MCP tools where applicable) after the review period to confirm outcome; updates decision record. |
| **Dashboard (Next.js)** | Displays contract risk queue, exposure totals, pending approvals, action history, savings realized. |
| **Auth & Tenant Layer** | Multi-tenant isolation, RBAC, per-org MCP server credentials/session storage. |

## A.5 High-Level Data Flow

```text
1. Scheduled job invokes MCP Drive/Gmail tools to discover new/updated contract documents.
2. Ingestion parses PDFs/docs (via MCP file-read tools) → raw_text stored in Postgres.
3. Orchestrator triggers agent graph per contract needing (re)analysis.
4. Detection Agent extracts structured clauses (JSON) → stored.
5. Risk Agent (optionally calling Okta MCP tool for usage data) + Finance Agent run in parallel.
6. Decision Agent synthesizes into a single recommendation object.
7. Deterministic rule layer checks thresholds → sets approval requirement.
8. Notification sent via Slack MCP tool / email / dashboard to responsible owner.
9. Human approves/edits/rejects via dashboard.
10. On approval, Action Executor calls MCP tool to send email / post Slack message / create task.
11. Verification Service re-checks after N days → updates outcome.
12. Outcome stored, feeds back into future Decision Agent confidence scoring.
```

## A.6 Deployment View (MVP)

```text
┌─────────────┐      ┌──────────────┐      ┌───────────────┐
│  Next.js UI │◄────►│   FastAPI    │◄────►│  PostgreSQL   │
│ (Vercel)    │      │ (single VM/  │      │  + pgvector   │
└─────────────┘      │  container)  │      │  (managed)    │
                      └──────┬───────┘      └───────────────┘
                             │
              ┌──────────────┼───────────────┬─────────────┐
              ▼              ▼               ▼             ▼
           Redis         LLM API        MCP Client     MCP Servers
        (job queue,     (OpenAI/         Layer         (Drive/Gmail/
        agent state)    Claude)                         Slack/Okta)
```

No Kubernetes, no Kafka, no multi-region setup for MVP — single container + managed Postgres + Redis + MCP client layer is sufficient at this scale.

## A.7 Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Security** | MCP server credentials/tokens encrypted at rest, tenant isolation via row-level `org_id` scoping, no autonomous financial/legal actions without approval, MCP tool calls scoped to minimum required permissions per tool. |
| **Reliability** | Agent runs are idempotent and resumable (LangGraph checkpointing); failed scans and failed MCP tool calls retried with backoff. |
| **Latency** | Not real-time; a full contract scan-to-recommendation cycle within minutes to hours is acceptable. |
| **Cost control** | Cap LLM calls per contract per scan cycle; cache extracted clauses so re-scans only re-run agents on changed documents; MCP tool calls also cached/deduped where safe. |
| **Auditability** | Every decision stores full evidence trail (extracted clauses, agent reasoning, confidence, MCP tool calls made, human action taken). |
| **Portability** | Swapping or adding a data source (e.g., replacing Okta with a different IdP) requires only adding/configuring a new MCP server — no core agent logic changes. |

## A.8 Architectural Decision Record: ADR-001 — Use MCP for External Connectors

**Decision:** All external system access (Drive, Gmail, Slack, Okta, and any future connectors) is implemented via MCP servers rather than bespoke per-service API clients.

**Rationale:**
- Avoids building and maintaining custom OAuth + REST client code per integration; leverages existing/community MCP servers where available (e.g., Drive, Gmail, Slack).
- Enforces a clean permission boundary — the agent only has access to the specific tools exposed by a connected MCP server, reinforcing the "AI never gets unrestricted production access" security principle.
- LangGraph has native support for MCP tool integration, so no restructuring of agent logic is required.
- New connectors (QuickBooks, DocuSign, HubSpot, etc.) can be added by connecting additional MCP servers without re-architecting the Ingestion Service or Agent Pool.

**Consequences:**
- Where a maintained MCP server does not yet exist for a needed system (e.g., Okta, at time of writing), the team must build and maintain a minimal custom MCP server rather than a full bespoke client — still narrower scope than a full integration.
- MCP server availability/versioning becomes an external dependency to track.
- The Decision Engine's deterministic rule layer remains outside MCP/agent scope entirely — MCP standardizes tool access only, never business logic or approval enforcement.

---

# PART B — LOW-LEVEL DESIGN (LLD)

## B.1 Database Schema (PostgreSQL)

```sql
-- Organizations & Users
organizations (id, name, created_at)
users (id, org_id, email, role, created_at)

-- MCP server connections (replaces raw OAuth token table from v1)
mcp_connections (
  id, org_id, mcp_server_type ENUM('google_drive','gmail','slack','okta'),
  mcp_server_url, auth_credentials_encrypted, scopes_granted,
  connected_by_user_id, status ENUM('active','expired','disconnected'),
  created_at, last_verified_at
)

-- Contracts
contracts (
  id, org_id, source ENUM('drive','gmail','manual_upload'),
  source_file_id, file_name, raw_text, uploaded_at,
  last_scanned_at, status ENUM('active','archived','parse_failed')
)

-- Extracted clauses (Detection Agent output)
contract_clauses (
  id, contract_id, vendor_name, renewal_date, auto_renew BOOLEAN,
  notice_period_days, price_escalation_pct, contract_value_annual,
  currency, extraction_confidence FLOAT, raw_extraction_json,
  extracted_at
)

-- Usage signals (optional, cross-referenced by Risk Agent)
usage_signals (
  id, org_id, vendor_name, last_login_at, active_users_count,
  seats_purchased, source ENUM('okta_mcp','manual'), recorded_at
)

-- Agent runs (audit trail) - now includes MCP tool call log
agent_runs (
  id, contract_id, agent_name, input_json, output_json,
  reasoning_summary, confidence FLOAT,
  mcp_tool_calls_json,   -- array of {tool_name, server, params, result_summary}
  started_at, completed_at, status
)

-- Decisions
decisions (
  id, contract_id, situation, root_cause, recommended_action,
  expected_impact_json, risk_level ENUM('low','medium','high'),
  confidence FLOAT, requires_approval BOOLEAN,
  approval_status ENUM('pending','approved','rejected','auto_approved'),
  approved_by_user_id, decided_at
)

-- Actions
actions (
  id, decision_id, action_type ENUM('email_draft','slack_alert',
           'task_created','cancellation_email_sent'),
  mcp_server_used, payload_json, executed_at, executed_by_user_id, status
)

-- Outcomes / Verification
outcomes (
  id, decision_id, expected_outcome, actual_outcome,
  verified_at, result ENUM('success','failure','inconclusive'),
  spend_delta_amount
)

-- Audit log
audit_logs (id, org_id, user_id, action, entity_type, entity_id, timestamp)
```

## B.2 MCP Connector Layer — Detailed Design

### B.2.1 MCP Client Manager

**Responsibility:** Maintains one MCP client session per `mcp_connections` row. Handles session establishment, credential refresh, and health checks.

**Key operations:**
```text
mcp_client_manager.get_client(org_id, server_type) -> MCP session
mcp_client_manager.verify_connection(connection_id) -> status
mcp_client_manager.disconnect(connection_id) -> revokes/clears session
```

### B.2.2 MCP Servers Used

| MCP Server | Provider type | Tools consumed by Termora |
|---|---|---|
| **Drive MCP** | Existing/community server | `list_files(folder_id)`, `read_file(file_id)`, `watch_folder(folder_id)` |
| **Gmail MCP** | Existing/community server | `search_emails(query)`, `get_attachment(message_id, attachment_id)` |
| **Slack MCP** | Existing/first-party server | `post_message(channel, text)`, `send_dm(user_id, text)` |
| **Okta MCP** | Custom-built (if no maintained server exists) | `get_user_activity(app_name)`, `get_active_seats(app_name)` |

### B.2.3 Tool Call Contract (example)

```json
{
  "tool": "drive.list_files",
  "server": "google_drive_mcp",
  "org_id": "org_123",
  "params": { "folder_id": "abc123" },
  "result": [
    {"file_id": "f1", "name": "VendorX_MSA_2026.pdf", "modified_at": "..."}
  ]
}
```

All tool calls are logged to `agent_runs.mcp_tool_calls_json` for audit purposes — this satisfies the auditability NFR without requiring a separate logging subsystem.

### B.2.4 Permission Scoping

Each MCP server connection is granted the **minimum tool scope** needed:
- Drive/Gmail MCP: read-only file/email access — no write/delete tools exposed to the agent.
- Slack MCP: `post_message`/`send_dm` only — no channel-management or admin tools exposed.
- Okta MCP: read-only activity/seat data — no user-management tools exposed.

This mirrors the original security principle: **AI → Controlled Tool → Permission Check → Validation → Business API → Result**, with "Controlled Tool" now explicitly implemented as a scoped MCP tool rather than a custom wrapper.

## B.3 Agent Specifications

### B.3.1 Detection Agent

**Input:** `raw_text` of a contract document (obtained via Drive/Gmail MCP `read_file`/`get_attachment` tool calls during ingestion).
**Task:** Extract structured clause data via LLM with a strict JSON schema (function-calling / structured output).
**Output schema:**
```json
{
  "vendor_name": "string",
  "renewal_date": "YYYY-MM-DD | null",
  "auto_renew": true,
  "notice_period_days": 30,
  "price_escalation_pct": 5.0,
  "contract_value_annual": 24000,
  "currency": "USD",
  "confidence": 0.87,
  "ambiguous_clauses": ["string describing anything unclear"]
}
```
**Failure mode handling:** If `confidence < 0.6`, flag contract for manual review instead of proceeding to Risk/Finance agents.

### B.3.2 Risk Agent

**Input:** `contract_clauses` + `usage_signals` (fetched via Okta MCP `get_user_activity`/`get_active_seats` tools, if connected).
**Task:** Determine if the contract is at risk of being wasted spend (low usage), a bad-faith auto-renew trap (short notice period + price escalation), or low risk.
**Output:**
```json
{
  "risk_type": "underused | price_escalation | short_notice_window | none",
  "risk_severity": "low | medium | high",
  "evidence": "1-2 sentence explanation grounded in the usage/clause data"
}
```

### B.3.3 Finance Agent

**Input:** `contract_clauses`, `risk_agent_output`.
**Task:** Estimate dollar exposure — cost of inaction vs. potential savings from cancellation/renegotiation.
**Output:**
```json
{
  "annual_cost_current": 24000,
  "annual_cost_if_renewed": 25200,
  "estimated_savings_if_cancelled": 25200,
  "estimated_savings_if_renegotiated": 3000
}
```
All arithmetic performed in deterministic Python — never delegated to the LLM or an MCP tool.

### B.3.4 Decision Agent

**Input:** Outputs of Detection, Risk, and Finance agents.
**Task:** Synthesize into one recommendation.
**Output:**
```json
{
  "situation": "Vendor X auto-renews in 18 days at $25,200/yr",
  "root_cause": "Only 2 of 15 purchased seats active in last 60 days",
  "recommended_action": "cancel | renegotiate_seats | renew | manual_review",
  "expected_impact": {"savings_annual": 21000},
  "risk": "low",
  "confidence": 0.91,
  "requires_human_approval": true
}
```
**Deterministic rule layer (not LLM, not MCP):** applies org-configured thresholds in plain Python.

### B.3.5 Action Agent

**Input:** Approved decision.
**Task:** Draft the actual artifact — a cancellation email, a renegotiation email, or a Slack summary.
**Execution:** Draft text is stored and shown in the dashboard. On explicit human "send" confirmation, the Action Executor invokes the relevant MCP tool (`slack.post_message` or an email-send MCP tool) — **never invoked automatically by the agent itself.**

## B.4 Orchestrator Logic (LangGraph state machine)

```text
START
  → mcp_ingest (Drive/Gmail MCP tools discover + fetch new documents)
  → detect_clauses (Detection Agent)
      → IF confidence < 0.6 → route to "manual_review" node → END
      → ELSE → parallel branch:
            → risk_agent (optionally calls Okta MCP tool)
            → finance_agent
      → join
  → decision_agent
  → deterministic_rule_check
      → IF requires_approval → notify_via_mcp_and_wait_for_human
           (Slack MCP post_message / dashboard / email)
      → ELSE → auto_log_as_informational
  → (on approval) action_agent → action_executor (MCP tool call to send)
  → schedule_verification(+N days)
END
```

State is checkpointed in Postgres per `contract_id` so a re-scan of an already-processed contract only re-runs nodes whose inputs changed, minimizing both LLM cost and redundant MCP tool calls.

## B.5 Key API Endpoints (FastAPI)

```text
POST   /connectors/mcp/{server_type}/connect        (initiate MCP server connection)
POST   /connectors/mcp/{server_type}/disconnect
GET    /connectors/mcp                               (list connection status per org)
POST   /contracts/scan                                (trigger manual scan)
GET    /contracts                                     (list, filter by risk/status)
GET    /contracts/{id}                                (detail + clause + agent trail)
GET    /decisions?status=pending                      (approval queue)
POST   /decisions/{id}/approve
POST   /decisions/{id}/reject
GET    /actions/{id}
POST   /actions/{id}/send                             (human confirms sending drafted email/Slack msg)
GET    /outcomes?decision_id=                         (verification results)
GET    /dashboard/summary                             (total exposure, savings realized)
```

## B.6 Security & Multi-Tenancy

- Every table scoped by `org_id`; row-level security enforced at the query layer.
- MCP connection credentials encrypted at rest (KMS-backed key), never logged, never sent to the LLM.
- LLM calls receive only the minimum contract text needed — no cross-contract or cross-tenant context ever included in a single prompt.
- MCP tool calls are scoped per-org; a given org's MCP session can never access another org's Drive/Gmail/Slack/Okta data.
- Action Executor requires a valid `approved_by_user_id` on the decision record before any MCP send/post tool call is permitted — enforced in code, not just UI.

## B.7 Error Handling & Retries

| Failure | Handling |
|---|---|
| PDF parse failure | Mark contract `status = parse_failed`, surface in dashboard for manual text paste. |
| LLM extraction low confidence | Route to manual review node (never silently guess). |
| LLM API timeout/error | Retry with exponential backoff (max 3), then mark `agent_runs.status = failed` and alert. |
| MCP tool call failure/timeout | Retry with backoff (max 3); if persistent, mark `mcp_connections.status = expired` and alert Org Admin to reconnect. |
| MCP server credential expired | Prompt re-auth via dashboard notification; pause scans for that connector until resolved. |
| Verification data unavailable | Mark outcome `inconclusive` rather than forcing a success/failure label. |

## B.8 MVP Build Order (maps to HLD components)

1. MCP Client Manager + Drive MCP connection + Postgres schema.
2. Detection Agent + manual-review fallback.
3. Risk + Finance agents (usage data can start as manual CSV upload before Okta MCP integration).
4. Decision Agent + deterministic rule layer + approval queue UI.
5. Slack MCP integration for notifications + Action Agent (draft-only) + human-send confirmation via MCP.
6. Verification job (scheduled re-check) + outcome dashboard.

---

*This HLD/LLD is scoped for MVP delivery. The MCP-based connector architecture (ADR-001) is designed to make future connector additions (QuickBooks, DocuSign, HubSpot, etc.) low-effort — each is simply a new MCP server connection, not a new integration subsystem.*
