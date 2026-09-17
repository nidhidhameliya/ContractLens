# Software Requirements Specification (SRS)
## ContractLens — AI Agent Pipeline for SaaS & Vendor Contract Risk Monitoring

**Version:** 2.0
**Status:** Draft for MVP
**Document conforms to structure inspired by IEEE 830-1998**
**Change from v1.0:** All external system connectors (Drive, Gmail, Slack, Okta) now specified via MCP (Model Context Protocol) servers rather than bespoke API clients; product renamed from Contract Sentinel to ContractLens.

---

## Table of Contents

1. Introduction
2. Overall Description
3. System Features (Functional Requirements)
4. External Interface Requirements
5. Non-Functional Requirements
6. Data Requirements
7. Other Requirements (Legal, Security, Compliance)
8. Appendices

---

# 1. Introduction

## 1.1 Purpose

This document specifies the software requirements for **ContractLens**, a multi-agent AI system that continuously monitors an organization's SaaS and vendor contracts, detects renewal and pricing risk, estimates financial exposure, and recommends actions (subject to human approval) to reduce wasted spend. It is intended for use by the development team, QA, and stakeholders as the authoritative reference for what the system must do in its MVP release.

## 1.2 Scope

ContractLens will:

- Ingest contract documents from connected sources (Google Drive, Gmail attachments, manual upload) via standardized **MCP server connections**.
- Extract structured contract terms (renewal date, auto-renew status, price escalation, notice period) using LLM-based document understanding.
- Cross-reference extracted terms against vendor usage data (via MCP, e.g. Okta) to identify underused or wasted subscriptions.
- Estimate the financial exposure of each contract's renewal.
- Generate a single, structured recommendation per contract (renew, renegotiate, cancel, or manual review).
- Enforce deterministic business-rule checks on every recommendation before it reaches a human.
- Route recommendations requiring approval to a responsible user via dashboard, Slack (via MCP), or email.
- Draft — but never autonomously send — action artifacts (cancellation emails, renegotiation emails, Slack alerts), sending only via MCP tool call after explicit human confirmation.
- Verify, after a configurable period, whether an approved action produced the expected financial outcome.
- Present all of the above through a web dashboard, with a full audit trail of every decision and every MCP tool call made.

**Out of scope for MVP:** autonomous execution of financial or contractual actions without human approval; integration with more than two contract/usage data sources; real-time (sub-hour) monitoring; multi-region deployment; support for non-English contracts; building MCP servers for connectors that already have a maintained, trustworthy MCP server available (custom MCP servers are built only where none exists, e.g. potentially Okta).

## 1.3 Definitions, Acronyms, and Abbreviations

| Term | Definition |
|---|---|
| **Agent** | A specialized LLM-driven component responsible for one task in the pipeline (e.g., Detection Agent). |
| **Orchestrator** | The component (LangGraph state machine) that sequences agent execution per contract. |
| **MCP (Model Context Protocol)** | A standardized protocol through which AI agents discover and call external tools (e.g., file access, messaging, identity/usage data) exposed by an MCP server, without a bespoke integration per system. |
| **MCP Server** | A service implementing the MCP specification that exposes a defined set of tools (e.g., `list_files`, `post_message`) for a specific external system (Drive, Gmail, Slack, Okta). |
| **MCP Client** | The component within ContractLens that establishes a session with an MCP server and issues tool calls on behalf of an agent. |
| **Clause extraction** | The process of converting unstructured contract text into structured JSON fields. |
| **Decision** | The structured recommendation object produced for a contract, combining agent outputs. |
| **Action** | A concrete artifact (email draft, Slack message, task) generated from an approved decision, executed via an MCP tool call. |
| **Outcome** | The measured real-world result of an executed action, compared against the expected impact. |
| **Org / Tenant** | A single customer organization using ContractLens; all data is isolated per org. |
| **RBAC** | Role-Based Access Control. |
| **LLM** | Large Language Model (e.g., GPT-4/5-class or Claude-class model) used for reasoning and extraction tasks. |

## 1.4 References

- Original concept document: *AI Business Operator* (internal project source document).
- Refined concept: *ContractLens* HLD/LLD document, v2 (internal, this project series — includes ADR-001 on MCP adoption).
- IEEE Std 830-1998, *Recommended Practice for Software Requirements Specifications* (structural reference only).
- Model Context Protocol specification (external standard governing MCP server/client behavior).

## 1.5 Overview

Section 2 describes the product context and constraints. Section 3 enumerates functional requirements grouped by system feature. Section 4 defines external interfaces, now specified in terms of MCP servers/tools. Section 5 defines non-functional requirements. Section 6 defines data requirements and retention. Section 7 covers legal, security, and compliance requirements. Section 8 contains supporting appendices.

---

# 2. Overall Description

## 2.1 Product Perspective

ContractLens is a **new, standalone product** that connects to a customer's existing document and identity systems (Drive, Gmail, Okta) via MCP servers, rather than replacing them or requiring bespoke integration work. It does not require the customer to migrate contracts into a new repository. It operates as a scan-and-recommend layer, not a contract lifecycle management (CLM) system of record.

```text
   Existing Systems         MCP Servers            ContractLens                Human Owner
 ┌─────────────────┐   ┌──────────────────┐   ┌─────────────────────┐   ┌───────────────┐
 │ Google Drive      │   │ Drive MCP          │   │ Ingestion → Agents → │   │ Finance /      │
 │ Gmail attachments   │──►│ Gmail MCP          │──►│ Decision → Approval →│──►│ Procurement    │
 │ Okta (usage)         │   │ Slack MCP          │   │ Action → Verification │   │ owner          │
 │ Slack                 │   │ Okta MCP           │   └─────────────────────┘   └───────────────┘
 └─────────────────┘   └──────────────────┘
```

## 2.2 Product Functions (Summary)

1. Connect to Google Drive / Gmail / Slack / Okta via MCP server connections and discover contract documents.
2. Parse and normalize contract text (including scanned/OCR documents) retrieved through MCP file tools.
3. Extract structured contract clauses via LLM.
4. Cross-reference usage/activity signals per vendor, retrieved via MCP where available.
5. Estimate financial exposure per contract.
6. Generate a recommended action with confidence and supporting evidence.
7. Apply deterministic approval-threshold rules.
8. Notify the responsible human (via MCP-based Slack tool, email, or dashboard) and collect approval/rejection.
9. Draft action artifacts for human-confirmed sending via MCP tool call.
10. Track execution and verify financial outcome after a review window.
11. Present a dashboard of exposure, pending approvals, realized savings, and MCP connection health.
12. Maintain a complete audit trail of every step for every contract, including every MCP tool call made.

## 2.3 User Classes and Characteristics

| User Class | Description | Technical Proficiency |
|---|---|---|
| **Finance/Procurement Owner** | Primary user; reviews and approves/rejects recommendations, sends approved actions. | Low-to-medium; expects a simple, low-friction UI. |
| **Org Admin** | Connects MCP data sources, manages users, configures approval thresholds. | Medium. |
| **Read-only Viewer** | Executives/stakeholders who view exposure and savings dashboards only. | Low. |
| **System (Agents)** | Non-human actors executing the pipeline via MCP tool calls; not a UI user but a first-class actor in requirements. | N/A |

## 2.4 Operating Environment

- Backend: Python/FastAPI service, containerized, deployable on a single cloud VM or container platform for MVP scale.
- Frontend: Next.js web application, accessed via modern browsers (Chrome, Edge, Safari, Firefox — latest two major versions).
- Database: Managed PostgreSQL with pgvector extension.
- MCP Layer: MCP client library within the FastAPI backend; connects to existing/community Drive, Gmail, and Slack MCP servers, and a custom-built Okta MCP server if no maintained equivalent exists at build time.
- No native mobile app for MVP; dashboard must be responsive for tablet/mobile browser viewing.

## 2.5 Design and Implementation Constraints

- LLM reasoning and unstructured-text extraction must use an LLM API (OpenAI or Anthropic); deterministic business logic (thresholds, permissions, financial calculations) **must not** be delegated to the LLM or to an MCP tool.
- All external system access (file reads, messaging, identity/usage data) must go through an MCP server connection — no direct bespoke API client implementations for Drive, Gmail, Slack, or Okta, per ADR-001.
- No autonomous execution of any action with external, hard-to-reverse consequences (sending an email, posting to Slack, cancelling a subscription) without explicit human approval — enforced in code at the Action Executor, not merely as a prompt instruction to the agent.
- Must operate within a defined LLM cost budget per organization per scan cycle.
- Single-tenant data isolation must be enforced at the database query layer (row-level scoping by `org_id`) and at the MCP session layer (one MCP session per org per connector; no shared sessions across tenants).

## 2.6 Assumptions and Dependencies

- Customers grant permission for ContractLens to establish MCP server connections to their Google Drive and/or Gmail (and optionally Slack, Okta); without this, ingestion and notification cannot function.
- Contract documents are primarily in English and in text-extractable or OCR-able PDF/DOCX format.
- Usage-signal data (e.g., via Okta MCP) is optional for MVP; the system must degrade gracefully (Risk Agent operates on clause data alone) when unavailable.
- Third-party LLM API and MCP server availability/pricing are dependencies outside the system's control; the system must handle both API outages and MCP server downtime without data loss (queued retry).
- Where a needed MCP server does not yet exist for a target system, ContractLens's engineering team is responsible for building and maintaining a minimal, scoped MCP server for that system.

---

# 3. System Features (Functional Requirements)

Each requirement is labeled `FR-<feature>-<number>` for traceability.

## 3.1 Feature: Contract Ingestion

**FR-ING-1:** The system shall allow an Org Admin to establish an MCP server connection to Google Drive and select one or more folders to monitor for contract documents.

**FR-ING-2:** The system shall allow an Org Admin to establish an MCP server connection to Gmail and scan for email attachments matching contract-like file types (PDF, DOCX) from a configurable set of senders or labels.

**FR-ING-3:** The system shall allow manual upload of a contract document (PDF/DOCX) by any authenticated user with write permission, independent of any MCP connection.

**FR-ING-4:** The system shall extract raw text from ingested documents, including OCR fallback for scanned/image-based PDFs.

**FR-ING-5:** The system shall deduplicate documents already ingested (based on file hash and source ID) to avoid redundant processing and redundant MCP tool calls.

**FR-ING-6:** If text extraction fails, the system shall mark the contract `status = parse_failed` and surface it in the dashboard for manual intervention, rather than silently dropping it.

**FR-ING-7:** The system shall re-scan connected MCP sources on a configurable schedule (default: daily) for new or updated documents.

**FR-ING-8:** If an MCP server connection becomes invalid or unreachable, the system shall mark the connection `status = expired`, halt scans for that connector, and notify the Org Admin, without affecting other connectors or previously ingested data.

## 3.2 Feature: Clause Extraction (Detection Agent)

**FR-DET-1:** The system shall extract, for each contract, the following fields at minimum: vendor name, renewal date, auto-renew status, notice period (days), price escalation percentage, annual contract value, currency.

**FR-DET-2:** Each extraction shall include a confidence score between 0 and 1.

**FR-DET-3:** If confidence is below a configurable threshold (default 0.6), the system shall route the contract to a "manual review" state instead of proceeding to downstream agents.

**FR-DET-4:** The system shall store the full raw extraction output (including any ambiguous-clause notes) for audit purposes.

**FR-DET-5:** The system shall support re-extraction if the source document is updated (new version detected via MCP).

## 3.3 Feature: Risk Assessment (Risk Agent)

**FR-RISK-1:** The system shall classify each contract's risk type as one of: underused, price-escalation risk, short-notice-window risk, or none.

**FR-RISK-2:** The system shall assign a risk severity (low, medium, high) with a plain-language evidence explanation grounded in extracted clause and/or usage data.

**FR-RISK-3:** When usage-signal data is unavailable (no Okta MCP connection configured) for a vendor, the Risk Agent shall base its assessment on clause data alone and shall not fabricate usage claims.

## 3.4 Feature: Financial Exposure Estimation (Finance Agent)

**FR-FIN-1:** The system shall calculate current annual cost, projected annual cost if renewed (including any price escalation), and estimated savings under cancellation and under renegotiation scenarios.

**FR-FIN-2:** All financial calculations shall be performed by deterministic code using LLM-extracted inputs, not by free-form LLM output and not by an MCP tool.

## 3.5 Feature: Decision Generation

**FR-DEC-1:** The system shall synthesize Detection, Risk, and Finance agent outputs into a single structured decision object containing: situation summary, root cause, recommended action, expected impact, risk level, confidence score, and approval requirement flag.

**FR-DEC-2:** The system shall apply deterministic, org-configurable rules to set `requires_human_approval = true` for any decision where estimated annual savings/exposure exceeds a configurable dollar threshold, or where risk level is "high," regardless of the LLM's own confidence.

**FR-DEC-3:** A decision with `requires_human_approval = false` (e.g., low-value informational finding) may be auto-logged without blocking on human review, but shall still appear in the audit trail.

## 3.6 Feature: Approval Workflow

**FR-APP-1:** The system shall notify the responsible owner of any pending decision via at least one of: dashboard, Slack (via MCP `post_message`/`send_dm` tool), email — configurable per organization.

**FR-APP-2:** The system shall allow an authorized user to approve, reject, or edit a recommended action before approval.

**FR-APP-3:** The system shall record the approving user's identity and timestamp on every approved decision.

**FR-APP-4:** The system shall support configurable approval routing (e.g., contracts above $X require a second approver).

## 3.7 Feature: Action Drafting and Execution

**FR-ACT-1:** Upon approval, the system shall generate a draft artifact (cancellation email, renegotiation email, or Slack summary) populated with contract-specific details.

**FR-ACT-2:** The system shall never invoke an MCP tool call that sends an email or posts an external message automatically; a human must explicitly confirm "send" for any externally-visible action in the MVP release, after which the Action Executor issues the corresponding MCP tool call.

**FR-ACT-3:** The system shall log the final sent/executed content, the specific MCP tool call made (server, tool name, parameters), timestamp, and executing user for every action.

## 3.8 Feature: Outcome Verification

**FR-VER-1:** The system shall schedule a verification check a configurable number of days after an action is executed (default: 30 days for renewals/cancellations).

**FR-VER-2:** The system shall compare expected outcome (from the decision's expected impact) against actual outcome (e.g., updated billing/usage data retrieved via MCP, or manual confirmation) and classify the result as success, failure, or inconclusive.

**FR-VER-3:** Verified outcomes shall be stored and made available to future Decision Agent runs as historical context (e.g., via pgvector similarity search over past decisions).

## 3.9 Feature: Dashboard & Reporting

**FR-DASH-1:** The system shall display a list of all contracts with current risk classification, renewal date, and exposure amount, filterable by risk level and status.

**FR-DASH-2:** The system shall display a pending-approvals queue.

**FR-DASH-3:** The system shall display a running total of estimated exposure and realized (verified) savings.

**FR-DASH-4:** The system shall display, for any contract, the full agent reasoning trail (evidence, confidence, decision history, and MCP tool calls made) for auditability.

**FR-DASH-5:** The system shall display the connection status (active/expired/disconnected) of every configured MCP server connection.

## 3.10 Feature: Administration & Access Control

**FR-ADM-1:** The system shall support Org Admin, standard user, and read-only viewer roles with distinct permissions.

**FR-ADM-2:** The system shall allow an Org Admin to configure approval thresholds, notification channels, and MCP server connections.

**FR-ADM-3:** The system shall allow an Org Admin to disconnect an MCP server connection, which shall halt further scans/tool calls via that connector without deleting previously ingested data.

**FR-ADM-4:** The system shall allow an Org Admin to view and revoke the specific tool-level permissions (scopes) granted to each connected MCP server.

---

# 4. External Interface Requirements

## 4.1 User Interfaces

- Web dashboard (Next.js/React) — responsive down to tablet width; desktop-first for MVP.
- Key screens: Contract list/risk queue, Contract detail (with agent + MCP tool call trail), Approval queue, Action history, Savings summary, Admin settings (including MCP connection management).

## 4.2 Software Interfaces (via MCP)

| MCP Server | Purpose | Tools Consumed |
|---|---|---|
| **Drive MCP** | Contract document discovery and retrieval | `list_files`, `read_file`, `watch_folder` |
| **Gmail MCP** | Attachment discovery | `search_emails`, `get_attachment` |
| **Slack MCP** | Approval notifications, alerts | `post_message`, `send_dm` |
| **Okta MCP** (custom-built if needed) | Usage/login signal retrieval | `get_user_activity`, `get_active_seats` |

Additionally:

| Interface | Purpose | Protocol |
|---|---|---|
| LLM Provider API (OpenAI/Anthropic) | Clause extraction, agent reasoning, decision synthesis | HTTPS/REST |
| SMTP/Email provider (or Email MCP server if available) | Sending approved emails, notification delivery | SMTP/API or MCP |

## 4.3 Communications Interfaces

- All external and internal API/MCP traffic over HTTPS/TLS 1.2+.
- Internal service-to-database traffic encrypted in transit.
- MCP client sessions authenticate per-organization; no session or credential is shared across tenants.

---

# 5. Non-Functional Requirements

**NFR-1 (Reliability):** Agent pipeline runs shall be idempotent and resumable; a failed run or failed MCP tool call shall be retried automatically (max 3 attempts, exponential backoff) before being marked failed and surfaced to an admin.

**NFR-2 (Latency):** A full scan-to-recommendation cycle for a single contract shall complete within a target of 15 minutes under normal load; the system is not required to support real-time (sub-minute) processing.

**NFR-3 (Scalability):** The MVP architecture shall support at least 500 contracts and 10 concurrent organizations without architectural changes; horizontal scaling of the agent-processing layer and MCP client layer shall be possible without a data-model redesign.

**NFR-4 (Security):** MCP connection credentials shall be encrypted at rest; all tenant data shall be isolated by `org_id` at the database query layer and the MCP session layer; no cross-tenant data shall ever be included in a single LLM prompt or MCP tool call context; each MCP server connection shall be scoped to the minimum tool set required (e.g., read-only for Drive/Gmail/Okta, message-only for Slack).

**NFR-5 (Auditability):** Every decision, agent run, MCP tool call, and action shall be permanently logged with full evidence and reasoning, retrievable via the dashboard and exportable for compliance review.

**NFR-6 (Usability):** A non-technical Finance/Procurement user shall be able to review and approve a recommendation without needing to understand MCP, the agent pipeline, or any underlying AI mechanics.

**NFR-7 (Cost control):** The system shall cap LLM API spend per organization per scan cycle via a configurable budget; re-scans of unchanged contracts shall skip redundant LLM calls and redundant MCP tool calls (cached extraction/results reused).

**NFR-8 (Availability):** The system shall target 99.5% uptime for the dashboard and notification services during MVP/beta; scheduled ingestion jobs and MCP server calls may tolerate brief delays without violating this target.

**NFR-9 (Maintainability):** Agent prompts, extraction schemas, business-rule thresholds, and MCP server connection configurations shall be externally configurable (not hardcoded) to allow iteration without a full redeploy.

**NFR-10 (Portability/Extensibility):** Adding a new external data source or action channel shall require only configuring a new MCP server connection and, if needed, exposing new tool calls to the relevant agent — no changes to core agent reasoning logic or the Decision Engine.

---

# 6. Data Requirements

## 6.1 Core Entities

Organizations, Users, MCP Connections, Contracts, Contract Clauses, Usage Signals, Agent Runs (including MCP tool call logs), Decisions, Actions, Outcomes, Audit Logs. (Full schema defined in the accompanying HLD/LLD document.)

## 6.2 Data Retention

- Raw contract text and extracted clauses retained for the lifetime of the customer relationship, or per customer-configured retention policy.
- Audit logs (including MCP tool call history) retained a minimum of 24 months for compliance traceability.
- Deleted/disconnected MCP connections: previously ingested documents are retained (not auto-deleted) unless the customer explicitly requests deletion, to preserve audit continuity.

## 6.3 Data Privacy

- Contract documents may contain sensitive commercial terms; access restricted by RBAC, tenant isolation, and MCP tool scope restrictions.
- No contract data used to train or fine-tune shared/third-party models without explicit customer consent.
- MCP tool call parameters and results are logged for audit purposes but are subject to the same access controls as the underlying contract data.

---

# 7. Other Requirements (Legal, Security, Compliance)

- **REQ-LEGAL-1:** The system shall not represent any drafted action (email, notice) as final or legally binding without explicit human review and sending.
- **REQ-SEC-1:** All authentication shall support standard organizational SSO where available (future consideration; MVP may use email/password + MCP-based OAuth for connectors).
- **REQ-SEC-2:** The system shall maintain role-based access control such that a Read-only Viewer cannot approve, reject, or execute any action, and cannot modify MCP server connections.
- **REQ-SEC-3:** Every MCP server connection shall be scoped to the minimum tool permissions required for ContractLens's functionality; no MCP connection shall request write, delete, or admin-level scopes unless a specific approved feature requires it.
- **REQ-COMP-1:** The audit trail shall be sufficient to reconstruct, for any executed action, what evidence led to the recommendation, which MCP tool calls retrieved the supporting data, who approved it, and what the verified outcome was — supporting internal finance/compliance review.

---

# 8. Appendices

## 8.1 Appendix A — Sample Decision Object

```json
{
  "situation": "Vendor X auto-renews in 18 days at $25,200/yr",
  "root_cause": "Only 2 of 15 purchased seats active in last 60 days",
  "recommended_action": "cancel",
  "expected_impact": { "savings_annual": 21000 },
  "risk": "low",
  "confidence": 0.91,
  "requires_human_approval": true
}
```

## 8.2 Appendix B — Sample MCP Tool Call Log Entry

```json
{
  "tool": "drive.read_file",
  "server": "google_drive_mcp",
  "org_id": "org_123",
  "params": { "file_id": "f1" },
  "result_summary": "Extracted 4,200 characters of contract text",
  "called_at": "2026-08-20T09:14:00Z"
}
```

## 8.3 Appendix C — Traceability Note

Every `FR-*` requirement in Section 3 maps to a corresponding pipeline stage and component defined in the companion **ContractLens HLD/LLD** document (MCP Client Layer, Ingestion Service, Agent Pool, Decision Engine, Approval & Notification Service, Action Executor, Verification Service, Dashboard). See ADR-001 in the HLD/LLD document for the rationale behind the MCP-based connector architecture. Implementation teams should cross-reference both documents together.

## 8.4 Appendix D — Open Questions for Stakeholder Sign-off

1. Default LLM budget cap per org per scan cycle — needs a concrete dollar figure before Phase 1 build.
2. Which MCP-accessible usage-signal source (Okta vs. manual CSV) should be prioritized for MVP given target customer profile?
3. Notification channel priority order (Slack MCP vs. email vs. dashboard-only) for initial pilot customers.
4. Whether an existing, trustworthy Okta MCP server exists at build time, or whether a custom minimal MCP server must be built in-house.
5. Data retention policy specifics — should follow customer contractual requirements once first pilot customer is identified.

---

*End of Software Requirements Specification.*

