"""
ContractLens — Contract Model
Stores raw contract document data after ingestion from Drive/Gmail/manual upload.
"""

import uuid
import enum
from sqlalchemy import String, ForeignKey, Enum as SAEnum, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime

from app.core.database import Base
from app.core.mixins import UUIDPrimaryKeyMixin, TimestampMixin


class ContractSource(str, enum.Enum):
    drive = "drive"
    gmail = "gmail"
    manual_upload = "manual_upload"


class ContractStatus(str, enum.Enum):
    active = "active"
    archived = "archived"
    parse_failed = "parse_failed"
    manual_review = "manual_review"
    scanning = "scanning"


class Contract(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "contracts"

    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    source: Mapped[ContractSource] = mapped_column(SAEnum(ContractSource), nullable=False)
    source_file_id: Mapped[str | None] = mapped_column(String(512), nullable=True)  # Drive/Gmail file ID
    file_name: Mapped[str] = mapped_column(String(512), nullable=False)
    file_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)  # SHA-256 for dedup
    raw_text: Mapped[str | None] = mapped_column(Text, nullable=True)  # Extracted text content
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    last_scanned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[ContractStatus] = mapped_column(
        SAEnum(ContractStatus), nullable=False, default=ContractStatus.active
    )

    # Relationships
    organization: Mapped["Organization"] = relationship("Organization", back_populates="contracts")
    clauses: Mapped[list["ContractClause"]] = relationship("ContractClause", back_populates="contract", cascade="all, delete-orphan")
    agent_runs: Mapped[list["AgentRun"]] = relationship("AgentRun", back_populates="contract", cascade="all, delete-orphan")
    decisions: Mapped[list["Decision"]] = relationship("Decision", back_populates="contract", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Contract id={self.id} file={self.file_name!r} status={self.status}>"

