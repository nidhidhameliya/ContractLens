"""
Termora — Team Management API
Admin-only: list org members, invite new users, update roles, remove users.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext

from app.core.database import get_db
from app.core.jwt import get_current_user
from app.users.user import User, UserRole

router = APIRouter()
logger = logging.getLogger(__name__)
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _require_admin(current_user: User):
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin role required.")


class InviteUserRequest(BaseModel):
    email: str
    full_name: str | None = None
    role: UserRole = UserRole.user


class UpdateRoleRequest(BaseModel):
    role: UserRole


@router.get("")
def list_team(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all users in the current org."""
    users = db.query(User).filter(User.org_id == current_user.org_id).all()
    return {
        "members": [
            {
                "id": str(u.id),
                "email": u.email,
                "full_name": u.full_name,
                "role": u.role.value,
                "created_at": u.created_at.isoformat() if hasattr(u, "created_at") and u.created_at else None,
            }
            for u in users
        ],
        "total": len(users),
    }


@router.post("/invite")
def invite_user(
    body: InviteUserRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin-only: invite (create) a new user in the org with a temp password."""
    _require_admin(current_user)

    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(status_code=409, detail="A user with this email already exists.")

    # Generate a temporary password — in production, send an invite email instead
    temp_password = f"Termora-{body.email.split('@')[0]}-2025!"
    new_user = User(
        org_id=current_user.org_id,
        email=body.email,
        full_name=body.full_name or body.email.split("@")[0].title(),
        password_hash=pwd_ctx.hash(temp_password),
        role=body.role,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    logger.info(f"[Team] Admin {current_user.email} invited {body.email} as {body.role.value}")
    return {
        "id": str(new_user.id),
        "email": new_user.email,
        "full_name": new_user.full_name,
        "role": new_user.role.value,
        "temp_password": temp_password,
        "WARNING_NOT_PRODUCTION": "Returning passwords in API responses is insecure. Wire up an email service (e.g. SendGrid) for production.",
        "message": "User created. Share the temporary password securely.",
    }


@router.patch("/{user_id}/role")
def update_user_role(
    user_id: str,
    body: UpdateRoleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin-only: change a team member's role."""
    _require_admin(current_user)

    if str(current_user.id) == user_id:
        raise HTTPException(status_code=400, detail="You cannot change your own role.")

    user = db.query(User).filter(
        User.id == user_id, User.org_id == current_user.org_id
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user.role = body.role
    db.commit()
    return {"id": str(user.id), "email": user.email, "role": user.role.value}


@router.delete("/{user_id}")
def remove_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin-only: remove a user from the org."""
    _require_admin(current_user)

    if str(current_user.id) == user_id:
        raise HTTPException(status_code=400, detail="You cannot remove yourself.")

    user = db.query(User).filter(
        User.id == user_id, User.org_id == current_user.org_id
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    db.delete(user)
    db.commit()
    logger.info(f"[Team] Admin {current_user.email} removed {user.email}")
    return {"message": f"User {user.email} removed from org."}
