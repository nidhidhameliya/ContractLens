"""
Termora — Renewal Calendar API
Returns upcoming contract renewals grouped by urgency bucket (30/60/90+ days).
Used by the /renewals frontend page.
"""

import logging
from datetime import datetime, date, timezone, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.jwt import get_current_user
from app.users.user import User
from app.contracts.contract import Contract
from app.contracts.contract_clause import ContractClause
from app.decisions.decision import Decision

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("")
def get_renewals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns contracts with known renewal dates, bucketed by urgency.
    Buckets: critical (<=30d), warning (31-60d), watch (61-90d), safe (>90d), expired.
    """
    today = date.today()

    clauses = (
        db.query(ContractClause)
        .join(Contract, ContractClause.contract_id == Contract.id)
        .filter(
            Contract.org_id == current_user.org_id,
            ContractClause.renewal_date.isnot(None),
        )
        .order_by(ContractClause.renewal_date.asc())
        .all()
    )

    buckets = {
        "expired": [],
        "critical": [],   # 0–30 days
        "warning": [],    # 31–60 days
        "watch": [],      # 61–90 days
        "safe": [],       # 90+ days
    }

    for clause in clauses:
        if not clause.renewal_date:
            continue

        renewal = clause.renewal_date if isinstance(clause.renewal_date, date) else clause.renewal_date.date()
        days_until = (renewal - today).days

        # Get the latest decision for this contract
        decision = (
            db.query(Decision)
            .filter(Decision.contract_id == clause.contract_id)
            .order_by(Decision.decided_at.desc())
            .first()
        )

        entry = {
            "contract_id": str(clause.contract_id),
            "vendor_name": clause.vendor_name or "Unknown Vendor",
            "renewal_date": renewal.isoformat(),
            "days_until_renewal": days_until,
            "auto_renew": clause.auto_renew,
            "notice_period_days": clause.notice_period_days,
            "contract_value_annual": clause.contract_value_annual,
            "currency": clause.currency or "USD",
            "notice_deadline": (renewal - timedelta(days=clause.notice_period_days or 30)).isoformat()
            if clause.notice_period_days
            else None,
            "risk_level": decision.risk_level.value if decision and decision.risk_level else None,
            "recommended_action": decision.recommended_action.value if decision and decision.recommended_action else None,
            "approval_status": decision.approval_status.value if decision else None,
        }

        if days_until < 0:
            buckets["expired"].append(entry)
        elif days_until <= 30:
            buckets["critical"].append(entry)
        elif days_until <= 60:
            buckets["warning"].append(entry)
        elif days_until <= 90:
            buckets["watch"].append(entry)
        else:
            buckets["safe"].append(entry)

    total = sum(len(v) for v in buckets.values())
    urgent = len(buckets["expired"]) + len(buckets["critical"]) + len(buckets["warning"])

    return {
        "today": today.isoformat(),
        "summary": {
            "total": total,
            "urgent": urgent,
            "expired": len(buckets["expired"]),
            "critical": len(buckets["critical"]),
            "warning": len(buckets["warning"]),
            "watch": len(buckets["watch"]),
            "safe": len(buckets["safe"]),
        },
        "buckets": buckets,
    }
