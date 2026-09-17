import uuid
from sqlalchemy import Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base
from app.core.mixins import UUIDPrimaryKeyMixin, TimestampMixin


class OrgSettings(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "org_settings"

    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True, unique=True
    )
    approval_threshold_usd: Mapped[float] = mapped_column(Float, nullable=False, default=5000.0)
    second_approver_threshold_usd: Mapped[float | None] = mapped_column(Float, nullable=True)
    display_currency: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")

    def __repr__(self) -> str:
        return f"<OrgSettings org_id={self.org_id} threshold={self.approval_threshold_usd}>"
