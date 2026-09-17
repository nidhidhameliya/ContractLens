# Termora

### Turn contracts into controlled decisions.

**Termora** is an AI-powered contract intelligence and governance platform that continuously identifies contractual risk, estimates financial exposure, and recommends actions — while deterministic policies and human approvals control what happens next.

Contracts don't just contain information. They contain **financial commitments, operational dependencies, deadlines, penalties, and risks**.

Termora turns those contracts into **actionable, governed decisions**.

---

## The Problem

Enterprise teams sign thousands of contracts, but most contracts are effectively forgotten after signature.

Important clauses can remain buried inside hundreds of pages:

* Auto-renewal deadlines
* Early termination penalties
* Weak SLA commitments
* Price escalation clauses
* Hidden financial obligations
* Renewal notice periods
* Liability limitations
* Unfavorable termination conditions

Legal and procurement teams cannot manually monitor every contract continuously.

The result is expensive surprises.

**Termora provides an always-on intelligence layer over the contract portfolio.**

---

## What Termora Does

Termora follows a simple principle:

> **AI understands. Policies govern. Humans decide. Systems execute.**

### 1. Understand

Termora ingests contracts and uses AI to extract:

* Parties
* Contract value
* Effective dates
* Renewal dates
* Payment obligations
* Termination conditions
* SLAs
* Penalties
* Risk clauses
* Important contractual obligations

### 2. Detect

AI analyzes the extracted contract information and identifies potential risks.

For example:

> **High Risk — Early Termination**

> Clause 4 requires the customer to pay the remaining contract balance plus a 30% termination penalty.

Termora doesn't simply flag the clause.

It evaluates its potential **business and financial impact**.

### 3. Decide

The AI generates a structured recommendation.

Example:

```text
Risk:
Predatory early termination clause

Estimated Exposure:
$45,000

Recommended Action:
Renegotiate termination terms

Priority:
High
```

### 4. Govern

This is where Termora differs from a traditional AI contract analyzer.

AI recommendations are **not automatically trusted**.

A deterministic policy engine evaluates the recommendation against organizational rules.

Example:

```text
Estimated Impact:     $45,000
Approval Threshold:   $5,000

$45,000 > $5,000

Result:
REQUIRES HUMAN APPROVAL
```

The policy engine, not the LLM, determines whether an action can proceed.

### 5. Execute

Once an authorized person approves the recommendation, Termora can generate and execute downstream actions through integrated tools.

For example:

* Draft a Slack notification
* Draft an email to a vendor
* Create a procurement task
* Create a legal review request
* Notify an internal stakeholder

Execution happens only after the appropriate governance checks have passed.

---

# Why Termora?

Most contract AI products focus primarily on **finding information**.

Termora focuses on what happens **after information is found**.

| Traditional Contract AI | Termora                      |
| ----------------------- | ---------------------------- |
| Extracts clauses        | Extracts + evaluates clauses |
| Finds risks             | Quantifies potential impact  |
| Provides summaries      | Recommends decisions         |
| AI-driven               | AI + deterministic policies  |
| Manual follow-up        | Governed workflows           |
| Passive analysis        | Continuous monitoring        |
| Information retrieval   | Decision + action lifecycle  |

Termora is designed to bridge the gap between:

**Contract → Risk → Decision → Approval → Action**

---

# Architecture

Termora uses a decoupled architecture designed around reliability, auditability, and controlled AI execution.

```text
                         ┌─────────────────────┐
                         │      Termora UI     │
                         │   Next.js / React   │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │      FastAPI        │
                         │   Application API   │
                         └──────────┬──────────┘
                                    │
                   ┌────────────────┼────────────────┐
                   │                │                │
                   ▼                ▼                ▼
             ┌───────────┐   ┌─────────────┐   ┌───────────┐
             │ Contracts │   │  Decisions  │   │  Policies │
             └───────────┘   └─────────────┘   └───────────┘
                   │                │                │
                   └────────────────┼────────────────┘
                                    ▼
                         ┌─────────────────────┐
                         │     LangGraph       │
                         │   AI Workflow       │
                         └──────────┬──────────┘
                                    │
                         ┌──────────▼──────────┐
                         │ Deterministic Policy│
                         │       Engine        │
                         └──────────┬──────────┘
                                    │
                              HITL Approval
                                    │
                         ┌──────────▼──────────┐
                         │      MCP Layer      │
                         │ External Actions    │
                         └─────────────────────┘
```

---

# Technology Stack

### Frontend

* Next.js 14
* React
* Tailwind CSS
* TypeScript

The interface is designed around an enterprise SaaS experience with clear separation between:

**AI-generated intelligence**

and

**deterministic governance decisions.**

---

### Backend

* FastAPI
* Python
* SQLAlchemy
* Pydantic

The backend provides APIs for contracts, risks, decisions, approvals, actions, policies, and audit events.

---

### AI & Agents

* LangGraph
* LangChain
* LLM-based contract analysis

LangGraph orchestrates the contract analysis workflow as a controlled state machine rather than relying on a single unrestricted LLM call.

---

### Integrations

Termora uses the **Model Context Protocol (MCP)** to connect AI workflows with external systems.

This allows the platform to interact with tools such as:

* Slack
* Gmail
* Jira
* Other enterprise systems

without tightly coupling the core application to every individual integration.

---

# AI + Deterministic Governance

This is the core architectural principle behind Termora.

LLMs are probabilistic.

Financial and compliance controls should not be.

Therefore:

```text
              AI
               │
               ▼
       Understand Contract
               │
               ▼
        Identify Risk
               │
               ▼
      Estimate Financial Impact
               │
               ▼
       Recommend Action
               │
               ▼
      ┌──────────────────┐
      │  Policy Engine   │
      │                  │
      │ Deterministic    │
      │ Rules            │
      └────────┬─────────┘
               │
        ┌──────┴───────┐
        │              │
        ▼              ▼
     Allowed       Approval
        │           Required
        │              │
        │              ▼
        │        Human Review
        │              │
        └──────┬───────┘
               ▼
            Execute
```

This separation ensures that an LLM cannot independently authorize a financially significant action.

---

# Example

## A $150,000 Marketing Contract

A company uploads:

```text
high_risk_marketing_vendor.pdf
```

### Contract

**Vendor:** Global Marketing Dynamics LLC

**Annual Value:** $150,000

Termora identifies:

> **Clause 4:** Early termination requires payment of the remaining contract balance plus a 30% penalty.

---

### AI Analysis

```text
Risk Level:
HIGH

Risk Category:
Termination

Estimated Financial Exposure:
$45,000

Recommended Action:
Renegotiate
```

---

### Policy Evaluation

Organization policy:

```text
approval_threshold_usd = $5,000
```

Termora evaluates:

```text
$45,000 > $5,000
```

Therefore:

```text
requires_approval = true
status = "PENDING"
```

The AI cannot bypass this decision.

---

### Human Approval

The manager opens the **Approvals** workspace.

Termora displays two separate sections:

**AI Analysis**

* Risk identified
* Supporting contract clause
* Confidence
* Estimated exposure
* Recommended action

**Policy Evaluation**

* Applicable policy
* Financial threshold
* Evaluation result
* Approval requirement

The manager approves the action.

---

### Action

Termora generates a draft internal notification:

```text
High-risk contract detected for Global Marketing
Dynamics.

Please review Clause 4 regarding the 30% early
termination penalty before signing.
```

The user can then approve execution and send it through the configured MCP integration.

---

# Auditability

Every important event is recorded.

The system maintains an auditable chain:

```text
Contract
   ↓
Analysis
   ↓
Risk
   ↓
Decision
   ↓
Policy Evaluation
   ↓
Approval
   ↓
Action
   ↓
Execution
```

This makes it possible to answer:

* What contract created the risk?
* Which clause was identified?
* What did the AI recommend?
* What financial impact was estimated?
* Which policy was applied?
* Who approved the action?
* What action was executed?
* When did it happen?

Termora treats **auditability as a first-class product requirement**, not an afterthought.

---

# Core Data Model

The platform separates the major lifecycle entities:

```text
User
 │
 ├── Policies
 │
 └── Contracts
       │
       ├── Risks
       │
       └── Decisions
              │
              ├── Policy Evaluation
              │
              └── Actions
                     │
                     └── Execution

AuditLog
```

This separation allows AI analysis, governance, approvals, and execution to remain independently traceable.

---

# Human-in-the-Loop

Termora is designed around **controlled autonomy**, not unrestricted automation.

The system can autonomously:

* Read contracts
* Extract information
* Identify risks
* Estimate exposure
* Recommend actions
* Prepare drafts

But organizational policy determines when human intervention is mandatory.

For example:

```text
Impact < $5,000
        ↓
Potentially eligible for automated workflow


Impact ≥ $5,000
        ↓
Human approval required
```

This allows organizations to automate routine decisions while maintaining control over high-impact actions.

---

# Product Principles

### Intelligence without blind trust

AI provides analysis and recommendations, but does not become the final authority.

### Automation with boundaries

Termora automates workflows while respecting explicit organizational policies.

### Explainable decisions

Users should understand **why** something was flagged and **why** an approval was required.

### Audit everything important

Contract intelligence should produce an accountable decision trail.

### Action, not just analysis

The ultimate goal isn't another dashboard.

It's turning contractual intelligence into controlled business action.

---

# Product Experience

Termora is organized around the lifecycle of contractual risk.

### Dashboard

A high-level view of:

* Active contracts
* High-risk contracts
* Upcoming renewals
* Financial exposure
* Pending approvals
* Recent actions

### Contracts

Search and explore the organization's contract portfolio.

### Risk Center

Prioritize contractual risks based on:

* Severity
* Financial exposure
* Deadline
* Contract importance
* Confidence

### Approvals

Review AI recommendations alongside deterministic policy evaluations.

### Actions

View proposed, approved, and executed actions.

### Policies

Configure organizational governance rules.

### Audit Log

Inspect the complete history of contract intelligence and actions.

---

# The Bigger Vision

Termora isn't designed to be another PDF analyzer.

The long-term vision is to become the **decision and governance layer for enterprise contracts**.

A future Termora workflow looks like:

```text
New Contract
     ↓
Understand
     ↓
Monitor
     ↓
Detect
     ↓
Quantify
     ↓
Decide
     ↓
Govern
     ↓
Approve
     ↓
Act
     ↓
Audit
```

Instead of asking:

> **"What does this contract say?"**

Termora helps organizations answer:

> **"What does this contract mean for our business, what should we do about it, and are we authorized to do it?"**

---

# Termora

### Turn contracts into controlled decisions.

**AI-powered contract intelligence.
Deterministic governance.
Human-controlled execution.**
