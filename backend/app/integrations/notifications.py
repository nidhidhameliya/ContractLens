"""
Termora — Notifications API
In-app notification feed: new contracts, approvals needed, and verification results.
"""

import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.jwt import get_current_user
from app.users.user import User
from app.decisions.decision import Decision, ApprovalStatus
from app.contracts.contract import Contract
from app.actions.outcome import Outcome, OutcomeResult
from app.contracts.contract_clause import ContractClause

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("")
def list_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns a unified list of in-app notifications for the current user's org.
    Sources: pending approvals, new contracts, verification results.
    """
    notifications = []
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=30)  # Show last 30 days

    # 1. Pending approvals (high priority)
    pending = (
        db.query(Decision)
        .join(Contract, Decision.contract_id == Contract.id)
        .filter(
            Contract.org_id == current_user.org_id,
            Decision.approval_status == ApprovalStatus.pending,
        )
        .order_by(Decision.decided_at.desc())
        .limit(10)
        .all()
    )
    for d in pending:
        clause = db.query(ContractClause).filter(ContractClause.contract_id == d.contract_id).order_by(ContractClause.created_at.desc()).first()
        vendor = clause.vendor_name if clause else "Unknown Vendor"
        impact = d.expected_impact_json or {}
        savings = float(impact.get("savings_annual", 0))
        notifications.append({
            "id": f"approval-{d.id}",
            "type": "approval_needed",
            "priority": "high",
            "title": f"Approval required: {vendor}",
            "body": f"AI recommends '{d.recommended_action.value if d.recommended_action else 'review'}' — potential savings ${savings:,.0f}",
            "href": "/approvals",
            "created_at": d.decided_at.isoformat() if d.decided_at else now.isoformat(),
            "read": False,
        })

    # 2. Recently verified outcomes
    recent_outcomes = (
        db.query(Outcome)
        .join(Decision)
        .join(Contract, Decision.contract_id == Contract.id)
        .filter(
            Contract.org_id == current_user.org_id,
            Outcome.verified_at >= since,
        )
        .order_by(Outcome.verified_at.desc())
        .limit(5)
        .all()
    )
    for o in recent_outcomes:
        decision = db.query(Decision).filter(Decision.id == o.decision_id).first()
        if not decision:
            continue
        clause = db.query(ContractClause).filter(ContractClause.contract_id == decision.contract_id).order_by(ContractClause.created_at.desc()).first()
        vendor = clause.vendor_name if clause else "Unknown Vendor"
        is_success = o.result == OutcomeResult.success
        notifications.append({
            "id": f"outcome-{o.id}",
            "type": "verification_result",
            "priority": "medium" if is_success else "high",
            "title": f"Outcome verified: {vendor}",
            "body": o.actual_outcome or ("Action confirmed successful." if is_success else "Verification failed — check status."),
            "href": "/approvals",
            "created_at": o.verified_at.isoformat() if o.verified_at else now.isoformat(),
            "read": False,
        })

    # 3. Recently ingested contracts (info level)
    recent_contracts = (
        db.query(Contract)
        .filter(
            Contract.org_id == current_user.org_id,
            Contract.uploaded_at >= since,
        )
        .order_by(Contract.uploaded_at.desc())
        .limit(5)
        .all()
    )
    for c in recent_contracts:
        notifications.append({
            "id": f"contract-{c.id}",
            "type": "new_contract",
            "priority": "low",
            "title": f"New contract ingested: {c.file_name}",
            "body": f"Contract from {c.source.value if c.source else 'upload'} — analysis in progress.",
            "href": f"/contracts/{c.id}",
            "created_at": c.uploaded_at.isoformat() if c.uploaded_at else now.isoformat(),
            "read": False,
        })

    # Sort by created_at descending
    notifications.sort(key=lambda n: n["created_at"], reverse=True)

    return {
        "notifications": notifications[:20],
        "unread_count": sum(1 for n in notifications if not n["read"] and n["priority"] in ("high", "medium")),
    }
