"""
Termora — Dashboard API Router
Aggregated metrics for the main dashboard view.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.jwt import get_current_user
from app.users.user import User
from app.contracts.contract import Contract
from app.decisions.decision import Decision, ApprovalStatus, RiskLevel
from app.actions.outcome import Outcome, OutcomeResult
from app.mcp_integration.mcp_connection import McpConnection

router = APIRouter()


@router.get("/summary")
def get_dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns all aggregated metrics needed for the dashboard landing page.
    Includes exposure totals, savings realized, risk breakdown, and MCP health.
    """
    org_id = current_user.org_id

    # Total contracts
    total_contracts = db.query(func.count(Contract.id)).filter(Contract.org_id == org_id).scalar()

    # Pending approvals count
    pending_approvals = (
        db.query(func.count(Decision.id))
        .join(Contract, Decision.contract_id == Contract.id)
        .filter(Contract.org_id == org_id, Decision.approval_status == ApprovalStatus.pending)
        .scalar()
    )

    # Total estimated exposure (sum of savings_annual for pending/approved decisions)
    decisions_with_impact = (
        db.query(Decision)
        .join(Contract, Decision.contract_id == Contract.id)
        .filter(Contract.org_id == org_id, Decision.approval_status.in_(["pending", "approved"]))
        .all()
    )
    total_exposure = sum(
        (d.expected_impact_json or {}).get("savings_annual", 0)
        for d in decisions_with_impact
    )

    # Realized savings (verified successful outcomes)
    realized_savings_result = (
        db.query(func.sum(Outcome.spend_delta_amount))
        .join(Decision, Outcome.decision_id == Decision.id)
        .join(Contract, Decision.contract_id == Contract.id)
        .filter(Contract.org_id == org_id, Outcome.result == OutcomeResult.success)
        .scalar()
    )
    realized_savings = float(realized_savings_result or 0)

    # Risk level breakdown
    risk_breakdown = {"high": 0, "medium": 0, "low": 0, "unknown": 0}
    all_decisions = (
        db.query(Decision)
        .join(Contract, Decision.contract_id == Contract.id)
        .filter(Contract.org_id == org_id)
        .all()
    )
    for d in all_decisions:
        level = d.risk_level.value if d.risk_level else "unknown"
        risk_breakdown[level] = risk_breakdown.get(level, 0) + 1

    # MCP connection health (FR-DASH-5)
    mcp_connections = db.query(McpConnection).filter(McpConnection.org_id == org_id).all()
    mcp_health = [
        {
            "server_type": conn.mcp_server_type.value,
            "status": conn.status.value,
            "last_verified_at": conn.last_verified_at.isoformat() if conn.last_verified_at else None,
        }
        for conn in mcp_connections
    ]

    return {
        "total_contracts": total_contracts,
        "pending_approvals": pending_approvals,
        "total_exposure_usd": round(total_exposure, 2),
        "realized_savings_usd": round(realized_savings, 2),
        "risk_breakdown": risk_breakdown,
        "mcp_connections": mcp_health,
    }
