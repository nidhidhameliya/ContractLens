"""
Termora — Actions API Router
View draft actions and trigger human-confirmed sending via MCP.
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.jwt import get_current_user
from app.core.rbac import require_user_or_admin
from app.users.user import User
from app.actions.action import Action, ActionStatus
from app.decisions.decision import Decision, ApprovalStatus
from app.contracts.contract import Contract

router = APIRouter()


@router.get("")
def list_actions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lists all actions (draft and sent) for the org."""
    actions = (
        db.query(Action)
        .join(Decision, Action.decision_id == Decision.id)
        .join(Contract, Decision.contract_id == Contract.id)
        .filter(Contract.org_id == current_user.org_id)
        .order_by(Action.created_at.desc())
        .all()
    )
    return {
        "actions": [_serialize_action(a) for a in actions],
        "total": len(actions),
    }


@router.get("/{action_id}")
def get_action(
    action_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns full action detail including the draft payload."""
    action = _get_action_or_404(action_id, current_user, db)
    return _serialize_action(action)


@router.post("/{action_id}/send")
def send_action(
    action_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user_or_admin),
):
    """
    Human-confirmed send endpoint (FR-ACT-2).
    Validates that the linked decision has been approved BEFORE making any MCP call.
    This is the gate that prevents autonomous sending — enforced in code, not just UI.
    """
    action = _get_action_or_404(action_id, current_user, db)

    if action.status == ActionStatus.sent:
        raise HTTPException(status_code=400, detail="Action already sent")
    if action.status == ActionStatus.cancelled:
        raise HTTPException(status_code=400, detail="Action was cancelled")

    # Critical: Verify the decision was actually approved by a human (B.6 security enforcement)
    decision = db.query(Decision).filter(Decision.id == action.decision_id).first()
    if not decision or decision.approval_status != ApprovalStatus.approved:
        raise HTTPException(
            status_code=403,
            detail="Cannot send: linked decision has not been approved by a human",
        )
    if not decision.approved_by_user_id:
        raise HTTPException(
            status_code=403,
            detail="Cannot send: no approver recorded on the decision",
        )

    # Invoke the appropriate MCP tool based on action_type
    mcp_server_used = _execute_via_mcp(action, current_user, db)

    action.status = ActionStatus.sent
    action.executed_at = datetime.now(timezone.utc)
    action.executed_by_user_id = current_user.id
    action.mcp_server_used = mcp_server_used

    from app.reports.audit_log import AuditLog
    audit = AuditLog(
        org_id=current_user.org_id,
        user_id=current_user.id,
        action="action.sent",
        entity_type="action",
        entity_id=action.id,
        timestamp=datetime.now(timezone.utc),
    )
    db.add(audit)
    db.commit()

    return {
        "message": "Action sent successfully",
        "action_id": action_id,
        "mcp_server_used": mcp_server_used,
        "sent_by": current_user.email,
        "sent_at": action.executed_at.isoformat(),
    }


def _execute_via_mcp(action: Action, user: User, db: Session) -> str:
    """Calls the appropriate MCP tool for the action type. Returns the server name used."""
    from app.mcp_integration import slack_tools

    payload = action.payload_json or {}

    # For email drafts, we use Slack DM in MVP (email MCP can be wired in Phase 7)
    if action.action_type.value in ("email_draft", "cancellation_email_sent", "renegotiation_email_sent"):
        body = payload.get("body", "")
        subject = payload.get("subject", "Contract Action")
        message = f"📄 *{subject}*\n\n{body}"

        if user.slack_user_id:
            slack_tools.send_dm(str(user.org_id), user.slack_user_id, message, db)
            return "slack_mcp"
        else:
            # No Slack user ID — log as sent without actual delivery
            return "dashboard_only"

    elif action.action_type.value == "slack_alert":
        channel = payload.get("channel", "#general")
        text = payload.get("body", "Contract alert from Termora")
        slack_tools.post_message(str(user.org_id), channel, text, db)
        return "slack_mcp"

    return "none"


def _get_action_or_404(action_id: str, current_user: User, db: Session) -> Action:
    action = (
        db.query(Action)
        .join(Decision, Action.decision_id == Decision.id)
        .join(Contract, Decision.contract_id == Contract.id)
        .filter(
            Action.id == uuid.UUID(action_id),
            Contract.org_id == current_user.org_id,
        )
        .first()
    )
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")
    return action


def _serialize_action(action: Action) -> dict:
    return {
        "id": str(action.id),
        "decision_id": str(action.decision_id),
        "action_type": action.action_type.value,
        "status": action.status.value,
        "payload": action.payload_json,
        "mcp_server_used": action.mcp_server_used,
        "executed_at": action.executed_at.isoformat() if action.executed_at else None,
        "created_at": action.created_at.isoformat() if action.created_at else None,
    }
