"""
ContractLens — Gmail MCP Tool Wrappers
Exposes search_emails and get_attachment operations.
"""

import logging
from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.mcp_integration.client_manager import mcp_client_manager
from app.mcp_integration.mcp_connection import McpServerType
from app.mcp_integration.drive_tools import MCPToolCallLog

logger = logging.getLogger(__name__)


@dataclass
class EmailResult:
    message_id: str
    subject: str
    sender: str
    attachment_ids: list[str] = field(default_factory=list)


def search_emails(org_id: str, query: str, db: Session) -> tuple[list[EmailResult], MCPToolCallLog]:
    """
    Searches Gmail for emails matching a query via MCP.
    Returns (email_results, tool_call_log).
    """
    client = mcp_client_manager.get_client(org_id, McpServerType.gmail, db)
    result = client.call_tool("search_emails", {"query": query})

    emails = [
        EmailResult(
            message_id=e["message_id"],
            subject=e.get("subject", ""),
            sender=e.get("from", ""),
        )
        for e in result
    ]

    log = MCPToolCallLog(
        tool="gmail.search_emails",
        server="gmail_mcp",
        org_id=org_id,
        params={"query": query},
        result_summary=f"Found {len(emails)} emails",
    )
    return emails, log


def get_attachment(org_id: str, message_id: str, attachment_id: str, db: Session) -> tuple[bytes, MCPToolCallLog]:
    """
    Fetches an email attachment as raw bytes via MCP.
    """
    client = mcp_client_manager.get_client(org_id, McpServerType.gmail, db)
    result = client.call_tool("get_attachment", {"message_id": message_id, "attachment_id": attachment_id})

    file_bytes = result if isinstance(result, bytes) else str(result).encode()

    log = MCPToolCallLog(
        tool="gmail.get_attachment",
        server="gmail_mcp",
        org_id=org_id,
        params={"message_id": message_id, "attachment_id": attachment_id},
        result_summary=f"Fetched {len(file_bytes)} bytes",
    )
    return file_bytes, log

