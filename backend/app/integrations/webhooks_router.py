"""
Termora — Webhook API
Lets orgs register outbound HTTP webhooks to receive events when decisions are made,
approved, or rejected — without needing MCP or polling.
"""

import logging
import uuid
import httpx
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import String, Text, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from pydantic import BaseModel, HttpUrl

from app.core.database import get_db, Base
from app.core.jwt import get_current_user
from app.users.user import User
from app.core.mixins import UUIDPrimaryKeyMixin, TimestampMixin

router = APIRouter()
logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────────────────────
# Model
# ──────────────────────────────────────────────────────────────────────────────

from app.integrations.webhook import Webhook


# ──────────────────────────────────────────────────────────────────────────────
# Schemas
# ──────────────────────────────────────────────────────────────────────────────

class CreateWebhookRequest(BaseModel):
    url: str
    description: str | None = None
    event_types: list[str] = ["decision.approved", "decision.rejected", "contract.scanned"]


class UpdateWebhookRequest(BaseModel):
    is_active: bool | None = None
    description: str | None = None
    event_types: list[str] | None = None


# ──────────────────────────────────────────────────────────────────────────────
# CRUD routes
# ──────────────────────────────────────────────────────────────────────────────

@router.get("")
def list_webhooks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    webhooks = db.query(Webhook).filter(Webhook.org_id == current_user.org_id).all()
    return {
        "webhooks": [
            {
                "id": str(w.id),
                "url": w.url,
                "description": w.description,
                "event_types": w.event_types.split(","),
                "is_active": w.is_active,
                "last_fired_at": w.last_fired_at.isoformat() if w.last_fired_at else None,
                "last_status_code": w.last_status_code,
                "created_at": w.created_at.isoformat() if w.created_at else None,
            }
            for w in webhooks
        ]
    }


@router.post("")
def create_webhook(
    body: CreateWebhookRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    webhook = Webhook(
        org_id=current_user.org_id,
        url=body.url,
        description=body.description,
        event_types=",".join(body.event_types),
        is_active=True,
    )
    db.add(webhook)
    db.commit()
    db.refresh(webhook)
    logger.info(f"[Webhook] Created {webhook.url} for org={current_user.org_id}")
    return {"id": str(webhook.id), "url": webhook.url, "message": "Webhook registered."}


@router.patch("/{webhook_id}")
def update_webhook(
    webhook_id: str,
    body: UpdateWebhookRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    wh = db.query(Webhook).filter(Webhook.id == webhook_id, Webhook.org_id == current_user.org_id).first()
    if not wh:
        raise HTTPException(status_code=404, detail="Webhook not found.")
    if body.is_active is not None:
        wh.is_active = body.is_active
    if body.description is not None:
        wh.description = body.description
    if body.event_types is not None:
        wh.event_types = ",".join(body.event_types)
    db.commit()
    return {"id": str(wh.id), "is_active": wh.is_active}


@router.delete("/{webhook_id}")
def delete_webhook(
    webhook_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    wh = db.query(Webhook).filter(Webhook.id == webhook_id, Webhook.org_id == current_user.org_id).first()
    if not wh:
        raise HTTPException(status_code=404, detail="Webhook not found.")
    db.delete(wh)
    db.commit()
    return {"message": "Webhook deleted."}


@router.post("/{webhook_id}/test")
def test_webhook(
    webhook_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fire a test ping to the webhook URL."""
    wh = db.query(Webhook).filter(Webhook.id == webhook_id, Webhook.org_id == current_user.org_id).first()
    if not wh:
        raise HTTPException(status_code=404, detail="Webhook not found.")
    background_tasks.add_task(_fire_webhook_sync, str(wh.id), wh.url, {
        "event": "webhook.test",
        "message": "This is a test ping from Termora.",
        "fired_at": datetime.now(timezone.utc).isoformat(),
    }, db)
    return {"message": f"Test ping queued to {wh.url}"}


# ──────────────────────────────────────────────────────────────────────────────
# Utility — called from decisions.py on approve/reject
# ──────────────────────────────────────────────────────────────────────────────

def fire_event(org_id, event_type: str, payload: dict, db: Session):
    """Find all active webhooks for this org+event and fire them."""
    webhooks = db.query(Webhook).filter(
        Webhook.org_id == org_id,
        Webhook.is_active == True,
    ).all()

    for wh in webhooks:
        if event_type in wh.event_types.split(","):
            _fire_webhook_sync(str(wh.id), wh.url, {"event": event_type, **payload}, db)


def _fire_webhook_sync(webhook_id: str, url: str, payload: dict, db: Session):
    """Fire webhook synchronously (called from BackgroundTasks or fire_event)."""
    try:
        resp = httpx.post(url, json=payload, timeout=10)
        logger.info(f"[Webhook] {url} → {resp.status_code}")
        status_code = resp.status_code
    except Exception as e:
        logger.error(f"[Webhook] Failed to fire {url}: {e}")
        status_code = 0

    # Update last_fired_at
    try:
        wh = db.query(Webhook).filter(Webhook.id == webhook_id).first()
        if wh:
            wh.last_fired_at = datetime.now(timezone.utc)
            wh.last_status_code = status_code
            db.commit()
    except Exception:
        pass
