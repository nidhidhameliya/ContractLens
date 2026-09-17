"""
ContractLens — Contract Clause Model
Structured output from the Detection Agent for a given contract.
Stores all key fields extracted from the raw contract text via LLM.
"""

import uuid
from datetime import date
from sqlalchemy import String, ForeignKey, Float, Boolean, Text, Date
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.core.database import Base
from app.core.mixins import UUIDPrimaryKeyMixin, TimestampMixin


class ContractClause(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "contract_clauses"

    contract_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contracts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    vendor_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    renewal_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    auto_renew: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    notice_period_days: Mapped[int | None] = mapped_column(nullable=True)
    price_escalation_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    contract_value_annual: Mapped[float | None] = mapped_column(Float, nullable=True)
    currency: Mapped[str | None] = mapped_column(String(10), nullable=True, default="USD")

    # LLM extraction quality indicators
    extraction_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    raw_extraction_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)  # Full LLM output preserved
    ambiguous_clauses: Mapped[list | None] = mapped_column(JSONB, nullable=True)  # Array of unclear clause notes

    # Relationships
    contract: Mapped["Contract"] = relationship("Contract", back_populates="clauses")

    def __repr__(self) -> str:
        return f"<ContractClause contract={self.contract_id} vendor={self.vendor_name!r} confidence={self.extraction_confidence}>"

