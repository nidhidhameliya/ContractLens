"""
Termora — RBAC (Role-Based Access Control)
Provides FastAPI dependencies for role enforcement.
"""

from fastapi import Depends, HTTPException, status
from app.users.user import User, UserRole
from app.core.jwt import get_current_user


def require_role(allowed_roles: list[str]):
    """
    Returns a FastAPI dependency that enforces role-based access.
    Usage:
        @router.post("/approve")
        def approve(user: User = Depends(require_role(["admin", "user"]))):
            ...
    """
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role.value not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {allowed_roles}. Your role: {current_user.role.value}",
            )
        return current_user
    return role_checker


# Pre-built common role guards
require_admin = require_role(["admin"])
require_user_or_admin = require_role(["admin", "user"])
require_any_role = require_role(["admin", "user", "viewer"])
