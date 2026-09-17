"""
Termora — OrgSettings API Router
Allows Org Admins to configure business rules, thresholds, and display preferences.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.core.database import get_db
from app.core.rbac import require_admin
from app.users.user import User
from app.core.org_settings import OrgSettings

router = APIRouter()


class OrgSettingsUpdate(BaseModel):
    approval_threshold_usd: float
    second_approver_threshold_usd: Optional[float] = None
    display_currency: Optional[str] = "USD"


class OrgSettingsResponse(BaseModel):
    approval_threshold_usd: float
    second_approver_threshold_usd: Optional[float] = None
    display_currency: str = "USD"


@router.get("", response_model=OrgSettingsResponse)
def get_org_settings(
    db: Session = Depends(get_db), 
    current_admin: User = Depends(require_admin)
):
    """Gets the current settings for the organization."""
    settings = db.query(OrgSettings).filter(OrgSettings.org_id == current_admin.org_id).first()
    
    if not settings:
        return OrgSettingsResponse(
            approval_threshold_usd=5000.0,
            second_approver_threshold_usd=None,
            display_currency="USD",
        )
        
    return OrgSettingsResponse(
        approval_threshold_usd=settings.approval_threshold_usd,
        second_approver_threshold_usd=settings.second_approver_threshold_usd,
        display_currency=getattr(settings, "display_currency", "USD"),
    )


@router.put("", response_model=OrgSettingsResponse)
def update_org_settings(
    request: OrgSettingsUpdate,
    db: Session = Depends(get_db), 
    current_admin: User = Depends(require_admin)
):
    """Updates the org settings including thresholds and display currency."""
    settings = db.query(OrgSettings).filter(OrgSettings.org_id == current_admin.org_id).first()
    
    if not settings:
        settings = OrgSettings(
            org_id=current_admin.org_id,
            approval_threshold_usd=request.approval_threshold_usd,
            second_approver_threshold_usd=request.second_approver_threshold_usd,
        )
        if hasattr(settings, "display_currency"):
            settings.display_currency = request.display_currency or "USD"
        db.add(settings)
    else:
        settings.approval_threshold_usd = request.approval_threshold_usd
        settings.second_approver_threshold_usd = request.second_approver_threshold_usd
        if hasattr(settings, "display_currency"):
            settings.display_currency = request.display_currency or "USD"
        
    db.commit()
    db.refresh(settings)
    
    return OrgSettingsResponse(
        approval_threshold_usd=settings.approval_threshold_usd,
        second_approver_threshold_usd=settings.second_approver_threshold_usd,
        display_currency=getattr(settings, "display_currency", "USD"),
    )
