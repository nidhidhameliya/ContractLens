"""
Termora — Okta MCP Tool Wrappers
Fetches usage/login data per vendor app.
Optional — Risk Agent degrades gracefully when unavailable (FR-RISK-3).
"""

import logging
from dataclasses import dataclass
from sqlalchemy.orm import Session

from app.mcp_integration.client_manager import mcp_client_manager
from app.mcp_integration.mcp_connection import McpServerType, McpConnectionStatus
from app.mcp_integration.drive_tools import MCPToolCallLog

logger = logging.getLogger(__name__)


@dataclass
class UserActivity:
    user: str
    last_login: str
    app: str


@dataclass
class SeatInfo:
    app: str
    active_users: int
    total_seats: int


def get_user_activity(org_id: str, app_name: str, db: Session) -> tuple[list[UserActivity] | None, MCPToolCallLog | None]:
    """
    Fetches user login activity for a specific app from Okta via MCP.
    Returns (None, None) if no Okta MCP connection is configured — graceful degradation.
    """
    from app.mcp_integration.mcp_connection import McpConnection

    okta_conn = (
        db.query(McpConnection)
        .filter(
            McpConnection.org_id == org_id,
            McpConnection.mcp_server_type == McpServerType.okta,
            McpConnection.status == McpConnectionStatus.active,
        )
        .first()
    )

    if not okta_conn:
        logger.info(f"[MCP Okta] No active connection for org={org_id} — Risk Agent will use clause data only")
        return None, None

    client = mcp_client_manager.get_client(org_id, McpServerType.okta, db)
    result = client.call_tool("get_user_activity", {"app_name": app_name})

    activities = [UserActivity(user=u["user"], last_login=u["last_login"], app=u["app"]) for u in result]
    log = MCPToolCallLog(
        tool="okta.get_user_activity",
        server="okta_mcp",
        org_id=org_id,
        params={"app_name": app_name},
        result_summary=f"Retrieved {len(activities)} user activity records",
    )
    return activities, log


def get_active_seats(org_id: str, app_name: str, db: Session) -> tuple[SeatInfo | None, MCPToolCallLog | None]:
    """
    Fetches active seat counts for a specific app from Okta via MCP.
    Returns (None, None) if no Okta MCP connection — graceful degradation.
    """
    from app.mcp_integration.mcp_connection import McpConnection

    okta_conn = (
        db.query(McpConnection)
        .filter(
            McpConnection.org_id == org_id,
            McpConnection.mcp_server_type == McpServerType.okta,
            McpConnection.status == McpConnectionStatus.active,
        )
        .first()
    )

    if not okta_conn:
        return None, None

    client = mcp_client_manager.get_client(org_id, McpServerType.okta, db)
    result = client.call_tool("get_active_seats", {"app_name": app_name})

    seat_info = SeatInfo(
        app=result.get("app", app_name),
        active_users=result.get("active_users", 0),
        total_seats=result.get("total_seats", 0),
    )
    log = MCPToolCallLog(
        tool="okta.get_active_seats",
        server="okta_mcp",
        org_id=org_id,
        params={"app_name": app_name},
        result_summary=f"Active: {seat_info.active_users}/{seat_info.total_seats} seats",
    )
    return seat_info, log
