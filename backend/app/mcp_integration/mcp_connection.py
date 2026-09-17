import uuid
import enum
from sqlalchemy import String, ForeignKey, Enum as SAEnum, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime

from app.core.database import Base
from app.core.mixins import UUIDPrimaryKeyMixin, TimestampMixin


class McpServerType(str, enum.Enum):
    google_drive = "google_drive"
    gmail = "gmail"
    slack = "slack"
    okta = "okta"


class McpConnectionStatus(str, enum.Enum):
    active = "active"
    expired = "expired"
    disconnected = "disconnected"


class McpConnection(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "mcp_connections"

    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    mcp_server_type: Mapped[McpServerType] = mapped_column(SAEnum(McpServerType), nullable=False)
    mcp_server_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    auth_credentials_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    scopes_granted: Mapped[str | None] = mapped_column(Text, nullable=True)
    connected_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    status: Mapped[McpConnectionStatus] = mapped_column(
        SAEnum(McpConnectionStatus), nullable=False, default=McpConnectionStatus.disconnected
    )
    last_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    def __repr__(self) -> str:
        return f"<McpConnection id={self.id} type={self.mcp_server_type} status={self.status}>"
