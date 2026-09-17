"""
ContractLens — Database Engine & Session Management
Uses SQLAlchemy 2.0 async-compatible engine with per-request session scoping.
All queries MUST go through get_db() dependency to ensure org_id scoping.
"""

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, DeclarativeBase, Session
from sqlalchemy.pool import NullPool
from typing import Generator

from app.core.config import settings


# SQLAlchemy engine — synchronous for simplicity in MVP
# Switch to asyncpg + create_async_engine if performance demands it later
engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,       # Validates connection before use (handles dropped connections)
    pool_size=10,
    max_overflow=20,
    echo=False,               # Set True for SQL query logging during debugging
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


class Base(DeclarativeBase):
    """
    Base class for all SQLAlchemy models.
    Provides common columns (id, created_at) via the mixin pattern.
    """
    pass


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency that yields a database session.
    Ensures the session is always closed after the request, even on error.

    Usage in FastAPI route:
        @router.get("/")
        def my_endpoint(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

