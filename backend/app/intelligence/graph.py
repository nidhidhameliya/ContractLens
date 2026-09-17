"""
Termora — LangGraph Orchestrator
Sequential pipeline (no parallel fan-out) to avoid INVALID_CONCURRENT_GRAPH_UPDATE.

Graph flow:
  START → detect_clauses
    → IF low confidence → manual_review → END
    → ELSE → fetch_usage_signals → risk_agent → finance_agent → decision_agent
           → rule_check
             → IF requires_approval → notify → END
             → ELSE → auto_log → END
"""

import logging
from langgraph.graph import StateGraph, END

from app.intelligence.state import ContractScanState
from app.intelligence.detection import run_detection_agent
from app.intelligence.risk import run_risk_agent
from app.intelligence.finance import run_finance_agent
from app.intelligence.decision import run_decision_agent
from app.decisions.decision_rules import apply_approval_rules

logger = logging.getLogger(__name__)


# ── Node functions ─────────────────────────────────────────────────────────────

def manual_review_node(state: ContractScanState) -> ContractScanState:
    """Routes low-confidence extractions to manual review."""
    logger.info(f"[Orchestrator] Contract {state['contract_id']} → manual_review")
    return {**state, "route": "manual_review"}


def fetch_usage_signals_node(state: ContractScanState) -> ContractScanState:
    """Fetches usage signals from the Okta/SQLite MCP server using the vendor name."""
    from app.mcp_integration.client_manager import mcp_client_manager
    from app.mcp_integration.mcp_connection import McpServerType
    from app.core.database import SessionLocal
    
    vendor_name = state.get("clauses", {}).get("vendor_name")
    if not vendor_name:
        return state

    db = SessionLocal()
    try:
        client = mcp_client_manager.get_client(state["org_id"], McpServerType.okta, db)
        result = client.call_tool("get_vendor_usage", {"vendor_name": vendor_name})
        
        if "error" not in result:
            state["usage_signals"] = result
            
            # Log the MCP call for the audit trail
            from app.intelligence.state import MCPToolCallLog
            from datetime import datetime, timezone
            log = MCPToolCallLog(
                tool="get_vendor_usage",
                server="okta_mcp",
                org_id=state["org_id"],
                params={"vendor_name": vendor_name},
                result_summary=f"Found {result.get('active_users', 0)} active users",
                called_at=datetime.now(timezone.utc).isoformat()
            )
            if "mcp_tool_calls" not in state or not state["mcp_tool_calls"]:
                state["mcp_tool_calls"] = []
            state["mcp_tool_calls"].append(log.to_dict())
    except Exception as e:
        logger.error(f"[Orchestrator] Failed to fetch usage signals via MCP: {e}")
    finally:
        db.close()
        
    return state


def auto_log_node(state: ContractScanState) -> ContractScanState:
    """Low-value decisions auto-approved without human review (FR-DEC-3)."""
    logger.info(f"[Orchestrator] Auto-logging decision for contract={state['contract_id']}")
    return {**state, "route": "auto_log"}


def notify_node(state: ContractScanState) -> ContractScanState:
    """Notifies owner; graph suspends awaiting human approval."""
    logger.info(f"[Orchestrator] Awaiting human approval for contract={state['contract_id']}")
    return {**state, "route": "awaiting_approval"}


# ── Routing functions ──────────────────────────────────────────────────────────

def route_after_detection(state: ContractScanState) -> str:
    return state.get("route", "continue")


def route_after_rules(state: ContractScanState) -> str:
    return state.get("route", "auto_log")


# ── Graph Assembly ─────────────────────────────────────────────────────────────

def build_graph() -> StateGraph:
    """Builds and compiles the Termora LangGraph sequential pipeline."""
    graph = StateGraph(ContractScanState)

    # Add all nodes
    graph.add_node("detect_clauses", run_detection_agent)
    graph.add_node("manual_review", manual_review_node)
    graph.add_node("fetch_usage_signals", fetch_usage_signals_node)
    graph.add_node("risk_agent", run_risk_agent)
    graph.add_node("finance_agent", run_finance_agent)
    graph.add_node("decision_agent", run_decision_agent)
    graph.add_node("rule_check", apply_approval_rules)
    graph.add_node("notify", notify_node)
    graph.add_node("auto_log", auto_log_node)

    # Entry
    graph.set_entry_point("detect_clauses")

    # Detection → conditional routing
    graph.add_conditional_edges(
        "detect_clauses",
        route_after_detection,
        {
            "manual_review": "manual_review",
            "continue": "fetch_usage_signals",
        },
    )
    graph.add_edge("manual_review", END)

    # Sequential branches
    graph.add_edge("fetch_usage_signals", "risk_agent")
    graph.add_edge("risk_agent", "finance_agent")
    graph.add_edge("finance_agent", "decision_agent")
    
    graph.add_edge("decision_agent", "rule_check")

    # Rule check → approval or auto-log
    graph.add_conditional_edges(
        "rule_check",
        route_after_rules,
        {
            "awaiting_approval": "notify",
            "auto_log": "auto_log",
        },
    )

    graph.add_edge("notify", END)
    graph.add_edge("auto_log", END)

    return graph.compile()


# Singleton compiled graph — imported by the contracts API
Termora_graph = build_graph()
