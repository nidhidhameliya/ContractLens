"""
Termora — LangGraph State Definition
The ContractScanState TypedDict flows through every node in the graph.
All agent outputs accumulate here and are checkpointed to Postgres between nodes.

Uses Annotated[list, operator.add] for mcp_tool_calls so parallel nodes can safely
append to it without LangGraph raising INVALID_CONCURRENT_GRAPH_UPDATE.
"""

import operator
from typing import TypedDict, Optional, Annotated
from dataclasses import dataclass


@dataclass
class MCPToolCallLog:
    """Represents a single logged MCP tool call for the audit trail."""
    tool: str
    server: str
    org_id: str
    params: dict
    result_summary: str
    called_at: str = ""

    def to_dict(self) -> dict:
        return {
            "tool": self.tool,
            "server": self.server,
            "org_id": self.org_id,
            "params": self.params,
            "result_summary": self.result_summary,
            "called_at": self.called_at,
        }


class ContractScanState(TypedDict):
    """
    The central state object that flows through the LangGraph pipeline.
    Every node reads from and writes to this state.
    Checkpointed to Postgres after each node so re-scans only re-run changed nodes.
    """
    # Core identifiers (set at graph entry)
    contract_id: str
    org_id: str
    raw_text: str
    file_name: str

    # Detection Agent output
    clauses: Optional[dict]               # Structured clause JSON from Detection Agent
    detection_confidence: Optional[float]

    # Usage data from Okta MCP (optional)
    usage_signals: Optional[dict]         # {"active_users": 2, "total_seats": 15, ...}

    # Risk Agent output
    risk_output: Optional[dict]           # {"risk_type": ..., "risk_severity": ..., "evidence": ...}

    # Finance Agent output (pure Python calculations)
    finance_output: Optional[dict]        # {"annual_cost_current": ..., "estimated_savings_if_cancelled": ...}

    # Decision Agent output
    decision_output: Optional[dict]       # Full decision recommendation object
    requires_approval: bool               # Set by deterministic rule layer

    # Annotated list: parallel nodes (Risk + Finance) can safely append without conflict
    mcp_tool_calls: Annotated[list[dict], operator.add]

    # Error tracking
    error: Optional[str]

    # Routing signal for conditional edges
    route: str                            # "continue" | "manual_review" | "awaiting_approval" | "done"
