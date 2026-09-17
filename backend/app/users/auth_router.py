"""
Termora — Auth API Router
Registration, login, and current user endpoints.
"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import bcrypt as _bcrypt
from pydantic import BaseModel, EmailStr
import uuid

from app.core.database import get_db
from app.users.organization import Organization
from app.users.user import User, UserRole
from app.core.jwt import create_access_token, get_current_user

router = APIRouter()


def _hash_password(password: str) -> str:
    return _bcrypt.hashpw(password.encode(), _bcrypt.gensalt()).decode()


def _verify_password(password: str, hashed: str) -> bool:
    return _bcrypt.checkpw(password.encode(), hashed.encode())



class RegisterRequest(BaseModel):
    org_name: str
    email: EmailStr
    password: str
    full_name: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    """Creates a new organization + admin user."""
    if db.query(User).filter(User.email == req.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    org = Organization(name=req.org_name)
    db.add(org)
    db.flush()  # Get org.id before committing

    user = User(
        org_id=org.id,
        email=req.email,
        password_hash=_hash_password(req.password),
        full_name=req.full_name,
        role=UserRole.admin,  # First user in an org is always admin
    )
    db.add(user)
    db.commit()

    token = create_access_token(str(user.id), str(org.id), user.role.value)
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    """Authenticates a user and returns a JWT."""
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not _verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(str(user.id), str(user.org_id), user.role.value)
    return TokenResponse(access_token=token)


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    """Returns current user info."""
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role.value,
        "org_id": str(current_user.org_id),
    }
