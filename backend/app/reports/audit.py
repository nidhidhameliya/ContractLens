"""
ContractLens — Audit Log API Router
Exposes the immutable audit trail for frontend consumption.
Supports optional filtering by contract_id to power the Contract Detail timeline.
"""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.jwt import get_current_user
from app.users.user import User
from app.reports.audit_log import AuditLog

router = APIRouter()


@router.get("")
def list_audit_logs(
    contract_id: Optional[str] = Query(None, description="Filter by contract entity ID"),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns audit log events for the org.
    Optionally filtered by contract_id to show a contract's full history.
    """
    query = db.query(AuditLog).filter(AuditLog.org_id == current_user.org_id)

    if contract_id:
        try:
            cid = uuid.UUID(contract_id)
            query = query.filter(AuditLog.entity_id == cid)
        except ValueError:
            pass

    events = query.order_by(AuditLog.timestamp.desc()).limit(limit).all()

    return {
        "events": [
            {
                "id": str(e.id),
                "action": e.action,
                "entity_type": e.entity_type,
                "entity_id": str(e.entity_id) if e.entity_id else None,
                "user_id": str(e.user_id) if e.user_id else None,
                "detail": e.detail,
                "timestamp": e.timestamp.isoformat(),
            }
            for e in events
        ],
        "total": len(events),
    }

