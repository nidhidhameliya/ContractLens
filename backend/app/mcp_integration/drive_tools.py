"""
ContractLens — Google Drive MCP Tool Wrappers
Exposes list_files and read_file operations via the MCP Client Manager.
All tool calls are logged for the audit trail (FR-DASH-4, NFR-5).
"""

import logging
from datetime import datetime, timezone
from dataclasses import dataclass, field
from typing import Optional
from sqlalchemy.orm import Session

from app.mcp_integration.client_manager import mcp_client_manager
from app.mcp_integration.mcp_connection import McpServerType

logger = logging.getLogger(__name__)


@dataclass
class FileInfo:
    file_id: str
    name: str
    modified_at: Optional[str] = None


@dataclass
class MCPToolCallLog:
    """Logged to agent_runs.mcp_tool_calls_json for audit purposes."""
    tool: str
    server: str
    org_id: str
    params: dict
    result_summary: str
    called_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


def list_files(org_id: str, folder_id: str, db: Session) -> tuple[list[FileInfo], MCPToolCallLog]:
    """
    Lists files in a Drive folder via MCP.
    Returns (files, tool_call_log) — the log must be saved to agent_runs.
    """
    client = mcp_client_manager.get_client(org_id, McpServerType.google_drive, db)
    result = client.call_tool("list_files", {"folder_id": folder_id})

    files = [FileInfo(file_id=f["file_id"], name=f["name"], modified_at=f.get("modified_at")) for f in result]

    log = MCPToolCallLog(
        tool="drive.list_files",
        server="google_drive_mcp",
        org_id=org_id,
        params={"folder_id": folder_id},
        result_summary=f"Listed {len(files)} files",
    )
    logger.info(f"[MCP Drive] list_files org={org_id} folder={folder_id} → {len(files)} files")
    return files, log


def read_file(org_id: str, file_id: str, db: Session) -> tuple[bytes, MCPToolCallLog]:
    """
    Reads raw file bytes from Drive via MCP.
    Returns (file_bytes, tool_call_log).
    """
    client = mcp_client_manager.get_client(org_id, McpServerType.google_drive, db)
    result = client.call_tool("read_file", {"file_id": file_id})

    file_bytes = result if isinstance(result, bytes) else str(result).encode()

    log = MCPToolCallLog(
        tool="drive.read_file",
        server="google_drive_mcp",
        org_id=org_id,
        params={"file_id": file_id},
        result_summary=f"Read {len(file_bytes)} bytes",
    )
    logger.info(f"[MCP Drive] read_file org={org_id} file={file_id} → {len(file_bytes)} bytes")
    return file_bytes, log

