"""
Termora — Decision Model
The structured recommendation object synthesized from all agent outputs.
Contains both the LLM-generated content and the deterministic rule layer output.
"""

import uuid
import enum
from datetime import datetime
from sqlalchemy import String, ForeignKey, Enum as SAEnum, Float, Boolean, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.core.database import Base
from app.core.mixins import UUIDPrimaryKeyMixin, TimestampMixin
from pgvector.sqlalchemy import Vector


class RiskLevel(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"


class RecommendedAction(str, enum.Enum):
    cancel = "cancel"
    renegotiate_seats = "renegotiate_seats"
    renew = "renew"
    manual_review = "manual_review"


class ApprovalStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    auto_approved = "auto_approved"  # Low-value informational findings (FR-DEC-3)


class Decision(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "decisions"

    contract_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contracts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Decision Agent LLM output
    situation: Mapped[str | None] = mapped_column(Text, nullable=True)   # e.g., "Vendor X auto-renews in 18 days"
    root_cause: Mapped[str | None] = mapped_column(Text, nullable=True)  # e.g., "Only 2/15 seats active"
    recommended_action: Mapped[RecommendedAction | None] = mapped_column(SAEnum(RecommendedAction), nullable=True)
    expected_impact_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)  # {"savings_annual": 21000}
    risk_level: Mapped[RiskLevel | None] = mapped_column(SAEnum(RiskLevel), nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    embedding: Mapped[list[float] | None] = mapped_column(Vector(1536), nullable=True)

    # Deterministic rule layer output (pure Python, never LLM — FR-DEC-2)
    requires_approval: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    requires_second_approver: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    approval_status: Mapped[ApprovalStatus] = mapped_column(
        SAEnum(ApprovalStatus), nullable=False, default=ApprovalStatus.pending
    )
    approved_by_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    contract: Mapped["Contract"] = relationship("Contract", back_populates="decisions")
    actions: Mapped[list["Action"]] = relationship("Action", back_populates="decision", cascade="all, delete-orphan")
    outcomes: Mapped[list["Outcome"]] = relationship("Outcome", back_populates="decision", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Decision contract={self.contract_id} action={self.recommended_action} status={self.approval_status}>"


# Import at bottom to resolve SQLAlchemy string references for relationships
from app.actions.action import Action
from app.actions.outcome import Outcome
