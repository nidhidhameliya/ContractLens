"""
ContractLens — MCP Client Manager
Manages per-org MCP server sessions.
Handles session lifecycle: connect, verify, disconnect.
When MOCK_MCP=true, returns stub clients without live credentials.
"""

import json
import logging
from typing import Optional
from datetime import datetime, timezone
from functools import lru_cache

from sqlalchemy.orm import Session

from app.core.config import settings
from app.mcp_integration.mcp_connection import McpConnection, McpConnectionStatus, McpServerType
from app.mcp_integration.crypto import decrypt_credentials

logger = logging.getLogger(__name__)

# In-memory session registry: (org_id, server_type) -> session object
_session_registry: dict[tuple, object] = {}


class MockMcpSession:
    """
    Mock MCP session used when MOCK_MCP=true.
    Returns predictable stub data so development can proceed without live credentials.
    """
    def __init__(self, server_type: McpServerType, scopes_granted: Optional[list[str]] = None):
        self.server_type = server_type
        self.scopes_granted = scopes_granted

    def call_tool(self, tool_name: str, params: dict) -> dict:
        if self.scopes_granted is not None and tool_name not in self.scopes_granted:
            raise PermissionError(f"Tool {tool_name} is not in the granted scopes for {self.server_type}")
            
        logger.info(f"[MOCK MCP] {self.server_type}.{tool_name} called with params={params}")
        return self._stub_response(tool_name, params)

    def _stub_response(self, tool_name: str, params: dict) -> dict:
        stubs = {
            "list_files": [
                {"file_id": "mock_file_001", "name": "VendorX_MSA_2026.pdf", "modified_at": "2026-08-01T00:00:00Z"},
                {"file_id": "mock_file_002", "name": "CloudCorp_SaaS_Agreement.pdf", "modified_at": "2026-07-15T00:00:00Z"},
            ],
            "read_file": b"%PDF-1.4 mock contract text: Vendor X Master Service Agreement. "
                         b"Renewal Date: 2026-12-01. Auto-Renew: Yes. Notice Period: 30 days. "
                         b"Annual Value: $24,000 USD. Price escalation: 5% per annum.",
            "search_emails": [{"message_id": "msg_001", "subject": "Contract Renewal - Vendor X", "from": "vendor@example.com"}],
            "get_attachment": b"mock attachment bytes",
            "post_message": {"ok": True, "ts": "1234567890.000"},
            "send_dm": {"ok": True, "ts": "1234567890.001"},
            "get_user_activity": [
                {"user": "alice@company.com", "last_login": "2026-08-20", "app": "VendorX"},
                {"user": "bob@company.com", "last_login": "2026-06-01", "app": "VendorX"},
            ],
            "get_active_seats": {"app": "VendorX", "active_users": 2, "total_seats": 15},
        }
        
        return stubs.get(tool_name, {"result": "mock_ok"})

class RealMcpSession:
    """
    Real MCP session wrapper using stdio protocol.
    Runs asynchronously under the hood to satisfy FastAPI sync endpoints.
    """
    def __init__(self, command: str, args: list[str], scopes_granted: Optional[list[str]] = None):
        self.command = command
        self.args = args
        self.scopes_granted = scopes_granted

    def call_tool(self, tool_name: str, params: dict) -> dict:
        if self.scopes_granted is not None and tool_name not in self.scopes_granted:
            raise PermissionError(f"Tool {tool_name} is not in the granted scopes for this server")
            
        import asyncio
        import json
        from mcp import ClientSession, StdioServerParameters
        from mcp.client.stdio import stdio_client

        async def run():
            server_params = StdioServerParameters(command=self.command, args=self.args, env=None)
            async with stdio_client(server_params) as (read, write):
                async with ClientSession(read, write) as session:
                    await session.initialize()
                    result = await session.call_tool(tool_name, arguments=params)
                    text = result.content[0].text if result.content else "{}"
                    return json.loads(text)

        logger.info(f"[REAL MCP] Calling tool {tool_name} with params={params}")
        try:
            return asyncio.run(run())
        except Exception as e:
            logger.error(f"[REAL MCP] Error calling {tool_name}: {e}")
            return {"error": str(e)}


class McpClientManager:
    """
    Manages MCP server sessions per org.
    In MOCK_MCP mode, all sessions are stub objects — no network calls.
    In production mode, establishes real MCP protocol sessions.
    """

    def get_client(self, org_id: str, server_type: McpServerType, db: Session) -> MockMcpSession:
        """
        Returns an active MCP session for the given org + server type.
        Creates a new session if one doesn't exist in the registry.
        """
        key = (str(org_id), server_type)

        if settings.mock_mcp:
            if key not in _session_registry:
                # If mock, we'd theoretically need the connection to get scopes, but for simplicity:
                connection = db.query(McpConnection).filter(
                    McpConnection.org_id == org_id,
                    McpConnection.mcp_server_type == server_type
                ).first()
                scopes = json.loads(connection.scopes_granted) if connection and connection.scopes_granted else None
                _session_registry[key] = MockMcpSession(server_type, scopes_granted=scopes)
            return _session_registry[key]

        # Production: look up the connection record and establish a real session
        connection = (
            db.query(McpConnection)
            .filter(
                McpConnection.org_id == org_id,
                McpConnection.mcp_server_type == server_type,
                McpConnection.status == McpConnectionStatus.active,
            )
            .first()
        )

        if key not in _session_registry:
            if connection:
                credentials = decrypt_credentials(connection.auth_credentials_encrypted)
                parts = connection.mcp_server_url.split(" ")
            else:
                # Default fallback for MVP demo if not configured in UI
                if server_type == McpServerType.okta:
                    parts = ["python", "../sqlite_mcp.py"]
                elif server_type == McpServerType.google_drive:
                    parts = ["python", "../mock_drive_mcp.py"]
                elif server_type == McpServerType.slack:
                    parts = ["python", "../mock_slack_mcp.py"]
                else:
                    raise ValueError(f"No active MCP connection found for org={org_id} type={server_type}")

            cmd = parts[0]
            args = parts[1:] if len(parts) > 1 else []
            
            scopes = json.loads(connection.scopes_granted) if connection and connection.scopes_granted else None
            
            _session_registry[key] = RealMcpSession(cmd, args, scopes_granted=scopes)

        return _session_registry[key]

    def verify_connection(self, connection: McpConnection, db: Session) -> McpConnectionStatus:
        """
        Pings the MCP server with a list_tools call.
        Updates last_verified_at on success, marks expired on failure.
        """
        try:
            client = self.get_client(str(connection.org_id), connection.mcp_server_type, db)
            client.call_tool("list_files", {"folder_id": "ping"})
            connection.status = McpConnectionStatus.active
            connection.last_verified_at = datetime.now(timezone.utc)
            db.commit()
            return McpConnectionStatus.active
        except Exception as e:
            logger.error(f"MCP connection verify failed for {connection.id}: {e}")
            connection.status = McpConnectionStatus.expired
            db.commit()
            return McpConnectionStatus.expired

    def disconnect(self, connection: McpConnection, db: Session) -> None:
        """
        Clears the in-memory session and marks the connection as disconnected.
        """
        key = (str(connection.org_id), connection.mcp_server_type)
        _session_registry.pop(key, None)
        connection.status = McpConnectionStatus.disconnected
        db.commit()
        logger.info(f"Disconnected MCP connection {connection.id} ({connection.mcp_server_type})")


# Singleton instance
mcp_client_manager = McpClientManager()

