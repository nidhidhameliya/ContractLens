"""
Termora — Slack MCP Tool Wrappers
Used for approval notifications and action delivery.
NEVER called autonomously — only after explicit human approval (FR-ACT-2).
"""

import logging
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.mcp_integration.client_manager import mcp_client_manager
from app.mcp_integration.mcp_connection import McpServerType
from app.mcp_integration.drive_tools import MCPToolCallLog

logger = logging.getLogger(__name__)


def post_message(org_id: str, channel: str, text: str, db: Session) -> MCPToolCallLog:
    """
    Posts a message to a Slack channel via MCP.
    Must only be called after explicit human confirmation (enforced by Action Executor).
    """
    client = mcp_client_manager.get_client(org_id, McpServerType.slack, db)
    result = client.call_tool("post_message", {"channel": channel, "text": text})

    log = MCPToolCallLog(
        tool="slack.post_message",
        server="slack_mcp",
        org_id=org_id,
        params={"channel": channel, "text_length": len(text)},
        result_summary=f"Message posted ok={result.get('ok', False)}",
    )
    logger.info(f"[MCP Slack] post_message org={org_id} channel={channel}")
    return log


def send_dm(org_id: str, slack_user_id: str, text: str, db: Session) -> MCPToolCallLog:
    """
    Sends a direct message to a Slack user via MCP.
    Used for approval notifications (FR-APP-1).
    """
    client = mcp_client_manager.get_client(org_id, McpServerType.slack, db)
    result = client.call_tool("send_dm", {"user_id": slack_user_id, "text": text})

    log = MCPToolCallLog(
        tool="slack.send_dm",
        server="slack_mcp",
        org_id=org_id,
        params={"user_id": slack_user_id, "text_length": len(text)},
        result_summary=f"DM sent ok={result.get('ok', False)}",
    )
    logger.info(f"[MCP Slack] send_dm org={org_id} user={slack_user_id}")
    return log
