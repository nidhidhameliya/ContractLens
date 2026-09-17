"""
ContractLens — Analytics API
Provides outcome ROI data and risk trend time-series for the analytics dashboard.
"""

import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.jwt import get_current_user
from app.users.user import User
from app.decisions.decision import Decision, ApprovalStatus
from app.contracts.contract import Contract
from app.actions.outcome import Outcome, OutcomeResult
from app.contracts.contract_clause import ContractClause

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/outcomes")
def get_outcome_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns ROI analytics: total predicted vs actual savings, win/loss breakdown."""
    decisions = (
        db.query(Decision)
        .join(Contract, Decision.contract_id == Contract.id)
        .filter(Contract.org_id == current_user.org_id)
        .all()
    )

    total_predicted = 0.0
    total_actual = 0.0
    wins = 0
    losses = 0
    pending_verification = 0
    vendor_breakdown = []

    for d in decisions:
        impact = d.expected_impact_json or {}
        predicted = float(impact.get("savings_annual", 0))
        total_predicted += predicted

        outcome = db.query(Outcome).filter(Outcome.decision_id == d.id).first()
        clause = db.query(ContractClause).filter(ContractClause.contract_id == d.contract_id).order_by(ContractClause.created_at.desc()).first()
        vendor = clause.vendor_name if clause else "Unknown"

        if outcome:
            actual = float(outcome.spend_delta_amount or 0)
            total_actual += actual
            if outcome.result == OutcomeResult.success:
                wins += 1
            else:
                losses += 1

            vendor_breakdown.append({
                "vendor": vendor,
                "predicted_savings": round(predicted, 2),
                "actual_savings": round(actual, 2),
                "result": outcome.result.value if outcome.result else "inconclusive",
                "verified_at": outcome.verified_at.isoformat() if outcome.verified_at else None,
            })
        else:
            if d.approval_status == ApprovalStatus.approved:
                pending_verification += 1

    accuracy_pct = None
    if total_predicted > 0:
        accuracy_pct = round((total_actual / total_predicted) * 100, 1)

    return {
        "total_predicted_savings": round(total_predicted, 2),
        "total_actual_savings": round(total_actual, 2),
        "accuracy_pct": accuracy_pct,
        "wins": wins,
        "losses": losses,
        "pending_verification": pending_verification,
        "total_decisions": len(decisions),
        "vendor_breakdown": vendor_breakdown[:20],
    }


@router.get("/risk-trend")
def get_risk_trend(
    days: int = 90,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns a time-series of decisions grouped by week and risk level for trend charts."""
    since = datetime.now(timezone.utc) - timedelta(days=days)

    decisions = (
        db.query(Decision)
        .join(Contract, Decision.contract_id == Contract.id)
        .filter(
            Contract.org_id == current_user.org_id,
            Decision.decided_at >= since,
        )
        .order_by(Decision.decided_at.asc())
        .all()
    )

    # Group by week
    weeks: dict[str, dict] = {}
    for d in decisions:
        if not d.decided_at:
            continue
        # ISO week key e.g. "2026-W34"
        week_key = d.decided_at.strftime("%Y-W%W")
        if week_key not in weeks:
            weeks[week_key] = {"week": week_key, "high": 0, "medium": 0, "low": 0, "total": 0}
        level = d.risk_level.value if d.risk_level else "low"
        weeks[week_key][level] = weeks[week_key].get(level, 0) + 1
        weeks[week_key]["total"] += 1

    return {
        "days": days,
        "data_points": list(weeks.values()),
        "total_scanned": len(decisions),
    }


@router.get("/summary")
def get_analytics_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Top-level analytics summary for the dashboard header."""
    decisions = (
        db.query(Decision)
        .join(Contract, Decision.contract_id == Contract.id)
        .filter(Contract.org_id == current_user.org_id)
        .all()
    )

    total_savings = sum(
        float((d.expected_impact_json or {}).get("savings_annual", 0))
        for d in decisions
        if d.approval_status == ApprovalStatus.approved
    )
    high_risk = sum(1 for d in decisions if d.risk_level and d.risk_level.value == "high")
    auto_approved = sum(1 for d in decisions if not d.requires_approval)

    return {
        "total_decisions": len(decisions),
        "approved_savings_usd": round(total_savings, 2),
        "high_risk_contracts": high_risk,
        "auto_approved": auto_approved,
    }

