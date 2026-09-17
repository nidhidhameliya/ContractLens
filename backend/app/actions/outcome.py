"""
ContractLens — Outcome Model
Records the verified real-world result of an executed action.
Compared against the decision's expected_impact to classify success/failure.
"""

import uuid
import enum
from datetime import datetime
from sqlalchemy import String, ForeignKey, Enum as SAEnum, Float, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base
from app.core.mixins import UUIDPrimaryKeyMixin, TimestampMixin


class OutcomeResult(str, enum.Enum):
    success = "success"
    failure = "failure"
    inconclusive = "inconclusive"  # When verification data unavailable (FR-VER-2)


class Outcome(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "outcomes"

    decision_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("decisions.id", ondelete="CASCADE"), nullable=False, index=True, unique=True
    )
    expected_outcome: Mapped[str | None] = mapped_column(Text, nullable=True)  # Text description of expected result
    actual_outcome: Mapped[str | None] = mapped_column(Text, nullable=True)    # Text description of measured result
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    result: Mapped[OutcomeResult | None] = mapped_column(SAEnum(OutcomeResult), nullable=True)
    spend_delta_amount: Mapped[float | None] = mapped_column(Float, nullable=True)  # Actual $ saved (positive) or lost (negative)

    # Relationships
    decision: Mapped["Decision"] = relationship("Decision", back_populates="outcomes")

    def __repr__(self) -> str:
        return f"<Outcome decision={self.decision_id} result={self.result} delta=${self.spend_delta_amount}>"

