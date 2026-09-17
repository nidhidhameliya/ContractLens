"""
Termora — Vendor Intelligence API
Cross-contract analytics per vendor: total spend, contract count, risk breakdown, renewal timeline.
"""

import logging
from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from collections import defaultdict

from app.core.database import get_db
from app.core.jwt import get_current_user
from app.users.user import User
from app.contracts.contract import Contract
from app.contracts.contract_clause import ContractClause
from app.decisions.decision import Decision

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("")
def get_vendor_intelligence(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Aggregates all contracts by vendor and returns spend, risk, and renewal intelligence per vendor.
    """
    clauses = (
        db.query(ContractClause)
        .join(Contract, ContractClause.contract_id == Contract.id)
        .filter(Contract.org_id == current_user.org_id)
        .all()
    )

    # Aggregate by vendor name
    vendors: dict[str, dict] = defaultdict(lambda: {
        "vendor_name": "",
        "contract_count": 0,
        "total_annual_spend": 0.0,
        "currency": "USD",
        "contracts": [],
        "risk_counts": {"high": 0, "medium": 0, "low": 0},
        "next_renewal": None,
        "days_until_next_renewal": None,
        "has_auto_renew": False,
        "avg_escalation_pct": [],
        "recommended_actions": [],
    })

    today = date.today()

    for clause in clauses:
        vendor = (clause.vendor_name or "Unknown Vendor").strip()
        v = vendors[vendor]
        v["vendor_name"] = vendor
        v["contract_count"] += 1
        v["total_annual_spend"] += float(clause.contract_value_annual or 0)
        if clause.currency:
            v["currency"] = clause.currency
        if clause.auto_renew:
            v["has_auto_renew"] = True
        if clause.price_escalation_pct:
            v["avg_escalation_pct"].append(float(clause.price_escalation_pct))

        # Track next renewal
        if clause.renewal_date:
            renewal = clause.renewal_date if isinstance(clause.renewal_date, date) else clause.renewal_date.date()
            days = (renewal - today).days
            if v["next_renewal"] is None or renewal < date.fromisoformat(v["next_renewal"]):
                v["next_renewal"] = renewal.isoformat()
                v["days_until_next_renewal"] = days

        # Get risk from decision
        decision = (
            db.query(Decision)
            .filter(Decision.contract_id == clause.contract_id)
            .order_by(Decision.decided_at.desc())
            .first()
        )
        if decision:
            risk = decision.risk_level.value if decision.risk_level else "low"
            v["risk_counts"][risk] = v["risk_counts"].get(risk, 0) + 1
            if decision.recommended_action:
                v["recommended_actions"].append(decision.recommended_action.value)

        v["contracts"].append({
            "contract_id": str(clause.contract_id),
            "annual_value": clause.contract_value_annual,
            "renewal_date": clause.renewal_date.isoformat() if clause.renewal_date else None,
        })

    # Post-process
    result = []
    for v in vendors.values():
        escs = v.pop("avg_escalation_pct", [])
        v["avg_escalation_pct"] = round(sum(escs) / len(escs), 2) if escs else None

        # Dominant risk
        rc = v["risk_counts"]
        if rc.get("high", 0) > 0:
            v["dominant_risk"] = "high"
        elif rc.get("medium", 0) > 0:
            v["dominant_risk"] = "medium"
        else:
            v["dominant_risk"] = "low"

        # Most common recommended action
        actions = v.pop("recommended_actions", [])
        v["primary_action"] = max(set(actions), key=actions.count) if actions else None

        result.append(v)

    # Sort by total spend descending
    result.sort(key=lambda v: v["total_annual_spend"], reverse=True)

    total_spend = sum(v["total_annual_spend"] for v in result)
    return {
        "vendor_count": len(result),
        "total_portfolio_spend": round(total_spend, 2),
        "vendors": result,
    }
