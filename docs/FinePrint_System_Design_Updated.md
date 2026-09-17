# ContractLens: As-Built Software Requirements Specification (SRS) & System Design

## 1. Introduction

**ContractLens** is an AI-powered contract risk monitoring and automated approval system. It combines the reasoning capabilities of Large Language Models (LLMs) with strict, deterministic business rules to evaluate, route, and execute business decisions regarding third-party contracts.

This document reflects the **As-Built** state of the ContractLens codebase, serving as a consolidated SRS and System Design reference.

## 2. High-Level Architecture

ContractLens utilizes a modern, decoupled client-server architecture:

- **Frontend:** Next.js 16 (React) with TailwindCSS and Lucide-React for styling.
- **Backend API:** FastAPI (Python) serving RESTful endpoints.
- **Database:** PostgreSQL (via SQLAlchemy ORM & Alembic for migrations).
- **Agent Engine:** LangGraph (StateGraph) for orchestrating the LLM reasoning loop.
- **Integration Layer:** Model Context Protocol (MCP) clients to interact with external tools (Google Drive, Gmail, Slack) in a sandbox.

### 2.1 Component Interaction

1. **User Interface (Next.js):** Provides dashboards for Org Admins and Approvers to view contracts, override agent decisions, and configure rules.
2. **REST API (FastAPI):** Exposes endpoints (`/api/contracts`, `/api/settings`, `/api/mcp`) that read/write to the database and trigger the agent workflow.
3. **Decision Engine (LangGraph):** When a contract is analyzed, LangGraph executes a multi-step graph:
   - Evaluates LLM confidence.
   - Cross-references deterministic business rules (e.g. `approval_threshold_usd`).
   - Invokes MCP tools safely to gather extra context.
4. **Data Persistence (PostgreSQL):** Stores all state, including Settings, Decisions, and an immutable Audit Log for compliance.

---

## 3. Core Data Model

The PostgreSQL database is organized into the following primary entities:

- **`User` / `Tenant`**: Defines organizational boundaries.
- **`OrgSettings`**: Stores tenant-specific configuration thresholds that drive deterministic rules (e.g., `approval_threshold_usd`, `second_approver_threshold_usd`, `llm_confidence_threshold`).
- **`Contract`**: Represents the ingested document/agreement, storing its raw text and metadata.
- **`Decision`**: The output of an evaluation. Contains `risk_score`, `llm_rationale`, `requires_human_approval` (boolean), `requires_second_approver` (boolean), and final `status` (pending, approved, rejected).
- **`AuditLog`**: An immutable ledger tracking system events (including MCP tool invocations and manual approvals).
- **`McpServerConfig`**: Connection URLs and security scopes for external MCP integrations.

---

## 4. Implemented Functional Requirements

### 4.1 AI-Driven Contract Analysis

- **Execution:** The backend uses LangGraph to process contracts. The LLM evaluates text against known compliance risks and generates a `risk_score` and a text `rationale`.
- **Confidence Tracking:** The LLM's confidence level is measured against the `llm_confidence_threshold` stored in `OrgSettings`.

### 4.2 Deterministic Guardrails (Business Rules)

ContractLens enforces strict rules outside of the LLM prompt to guarantee consistency.

- **Financial Thresholds:** If the estimated impact of a contract exceeds the `approval_threshold_usd`, the decision is deterministically flagged as `requires_human_approval = True`.
- **Second Approver Routing:** If the impact exceeds an even higher `second_approver_threshold_usd`, the system flags `requires_second_approver = True`, requiring multi-stage executive sign-off.

### 4.3 MCP Protocol & Tool Security

- **Dynamic Integrations:** The system connects to external services via the Model Context Protocol (MCP). The settings UI allows Admins to configure connection URLs (e.g., `mcp://google_drive:8000`).
- **Scope Revocation (Least Privilege):** Org Admins can explicitly define `scopes_granted` (an array of allowed tool names) for each connection.
- **Protocol-Level Enforcement:** The `McpClientManager` validates every tool invocation requested by the LLM against the allowed scopes. If a requested tool (e.g., `delete_file`) is not in the scope array, a `PermissionError` is immediately raised, blocking the action.

### 4.4 Data Retention & Compliance

- **Audit Logging:** Every major state change and MCP tool call is recorded in the `AuditLog`.
- **Automated Purging:** A background scheduler job (`app/jobs/retention.py`) runs daily to delete `AuditLog` entries older than 24 months, satisfying data minimization compliance.

---

## 5. Frontend System Design

The Next.js application acts as the control plane for the system.

### 5.1 Key Routes

- **`/` (Dashboard):** High-level metrics and system status overview.
- **`/contracts`**: A table displaying all analyzed contracts. Users can upload new contracts which trigger the FastAPI `/api/contracts` ingest pipeline.
- **`/approvals`**: The human-in-the-loop (HITL) interface. Displays pending decisions where `requires_human_approval` is True. Managers can click "Approve" or "Reject", executing `POST /api/decisions/{id}/approve`.
- **`/actions`**: Historical view of past automated and manual actions (reads from the `AuditLog`).
- **`/settings`**:
  - Allows Admins to update `OrgSettings` (Approval Thresholds, Confidence Thresholds).
  - Allows Admins to manage MCP Connections and their allowed Security Scopes.

### 5.2 State Management & Best Practices

- **API Wrapper:** All backend communication routes through a centralized `src/lib/api.ts` which handles authorization headers and error catching.
- **Hydration Safety:** The `AppShell` component handles authentication state checks securely on the client side, suppressing hydration mismatches caused by browser extensions via `suppressHydrationWarning`.

---

## 6. Security and Deployment Context

- **Row-Level Isolation:** All database queries are filtered by Tenant ID to prevent data leakage between organizations.
- **Mock vs. Real Environments:** The system supports a `MOCK_MCP` environment variable. When enabled, the `MockMcpSession` intercepts tool calls, allowing UI development and LLM prompt testing without requiring live Slack or Google Drive credentials.
- **API Framework:** FastAPI utilizes Pydantic V2 for strict request validation and serialization, preventing injection attacks.

