"""
Termora — Export API
Exports contracts and decisions to CSV format for audit and reporting.
"""

import csv
import io
import logging
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.jwt import get_current_user
from app.users.user import User
from app.contracts.contract import Contract
from app.contracts.contract_clause import ContractClause
from app.decisions.decision import Decision, ApprovalStatus

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/contracts")
def export_contracts_csv(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export all contracts (with clauses) to CSV."""
    contracts = (
        db.query(Contract)
        .filter(Contract.org_id == current_user.org_id)
        .order_by(Contract.uploaded_at.desc())
        .all()
    )

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=[
        "contract_id", "file_name", "source", "status",
        "vendor_name", "renewal_date", "auto_renew", "notice_period_days",
        "price_escalation_pct", "contract_value_annual", "currency",
        "extraction_confidence", "uploaded_at", "last_scanned_at",
    ])
    writer.writeheader()

    for c in contracts:
        clause = (
            db.query(ContractClause)
            .filter(ContractClause.contract_id == c.id)
            .order_by(ContractClause.created_at.desc())
            .first()
        )
        writer.writerow({
            "contract_id": str(c.id),
            "file_name": c.file_name,
            "source": c.source.value if c.source else "",
            "status": c.status.value if c.status else "",
            "vendor_name": clause.vendor_name if clause else "",
            "renewal_date": clause.renewal_date.isoformat() if clause and clause.renewal_date else "",
            "auto_renew": clause.auto_renew if clause else "",
            "notice_period_days": clause.notice_period_days if clause else "",
            "price_escalation_pct": clause.price_escalation_pct if clause else "",
            "contract_value_annual": clause.contract_value_annual if clause else "",
            "currency": clause.currency if clause else "USD",
            "extraction_confidence": clause.extraction_confidence if clause else "",
            "uploaded_at": c.uploaded_at.isoformat() if c.uploaded_at else "",
            "last_scanned_at": c.last_scanned_at.isoformat() if c.last_scanned_at else "",
        })

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=Termora_contracts.csv"},
    )


@router.get("/decisions")
def export_decisions_csv(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export all decisions with financial impact to CSV."""
    decisions = (
        db.query(Decision)
        .join(Contract, Decision.contract_id == Contract.id)
        .filter(Contract.org_id == current_user.org_id)
        .order_by(Decision.decided_at.desc())
        .all()
    )

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=[
        "decision_id", "contract_id", "vendor_name",
        "risk_level", "recommended_action", "approval_status",
        "confidence", "requires_approval", "requires_second_approver",
        "savings_annual", "situation", "root_cause", "decided_at",
    ])
    writer.writeheader()

    for d in decisions:
        clause = (
            db.query(ContractClause)
            .filter(ContractClause.contract_id == d.contract_id)
            .order_by(ContractClause.created_at.desc())
            .first()
        )
        impact = d.expected_impact_json or {}
        writer.writerow({
            "decision_id": str(d.id),
            "contract_id": str(d.contract_id),
            "vendor_name": clause.vendor_name if clause else "",
            "risk_level": d.risk_level.value if d.risk_level else "",
            "recommended_action": d.recommended_action.value if d.recommended_action else "",
            "approval_status": d.approval_status.value if d.approval_status else "",
            "confidence": round(d.confidence * 100, 1) if d.confidence else "",
            "requires_approval": d.requires_approval,
            "requires_second_approver": d.requires_second_approver,
            "savings_annual": impact.get("savings_annual", ""),
            "situation": (d.situation or "").replace("\n", " "),
            "root_cause": (d.root_cause or "").replace("\n", " "),
            "decided_at": d.decided_at.isoformat() if d.decided_at else "",
        })

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=Termora_decisions.csv"},
    )
