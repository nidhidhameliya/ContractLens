"""
Termora — Action Model
Stores draft artifacts (emails, Slack messages) generated after decision approval.
Tracks the specific MCP tool call used when a human confirms "send".
"""

import uuid
import enum
from datetime import datetime
from sqlalchemy import String, ForeignKey, Enum as SAEnum, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.core.database import Base
from app.core.mixins import UUIDPrimaryKeyMixin, TimestampMixin


class ActionType(str, enum.Enum):
    email_draft = "email_draft"
    slack_alert = "slack_alert"
    task_created = "task_created"
    cancellation_email_sent = "cancellation_email_sent"
    renegotiation_email_sent = "renegotiation_email_sent"


class ActionStatus(str, enum.Enum):
    draft = "draft"      # Generated, awaiting human send confirmation
    sent = "sent"        # Human confirmed send; MCP tool call executed
    cancelled = "cancelled"


class Action(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "actions"

    decision_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("decisions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    action_type: Mapped[ActionType] = mapped_column(SAEnum(ActionType), nullable=False)

    # Which MCP server was used to send (e.g., "slack", "email") — logged for audit (FR-ACT-3)
    mcp_server_used: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # The draft content — email body, Slack message text, etc.
    payload_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    executed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    executed_by_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    status: Mapped[ActionStatus] = mapped_column(SAEnum(ActionStatus), nullable=False, default=ActionStatus.draft)

    # Relationships
    decision: Mapped["Decision"] = relationship("Decision", back_populates="actions")

    def __repr__(self) -> str:
        return f"<Action type={self.action_type} status={self.status} decision={self.decision_id}>"
