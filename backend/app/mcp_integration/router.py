"""
Termora — MCP Connection API Router
Manages external MCP server connections (Google Drive, Gmail, Slack, Okta).
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.rbac import require_admin
from app.users.user import User
from app.mcp_integration.mcp_connection import McpConnection, McpServerType, McpConnectionStatus
from app.mcp_integration.client_manager import mcp_client_manager
from app.mcp_integration.crypto import encrypt_credentials

router = APIRouter()

class McpConnectionResponse(BaseModel):
    server_type: str
    url: Optional[str] = None
    status: str
    last_verified_at: Optional[str] = None
    scopes_granted: Optional[str] = None

class McpConnectRequest(BaseModel):
    url: str
    credentials: Optional[str] = None

@router.get("", response_model=List[McpConnectionResponse])
def list_mcp_connections(
    db: Session = Depends(get_db), 
    current_admin: User = Depends(require_admin)
):
    """Lists all MCP connections for the organization. Returns disconnected status for unset types."""
    connections = db.query(McpConnection).filter(McpConnection.org_id == current_admin.org_id).all()
    
    response = []
    conn_map = {c.mcp_server_type: c for c in connections}
    
    for server_type in McpServerType:
        if server_type in conn_map:
            c = conn_map[server_type]
            response.append({
                "server_type": c.mcp_server_type.value,
                "url": c.mcp_server_url,
                "status": c.status.value,
                "last_verified_at": c.last_verified_at.isoformat() if c.last_verified_at else None,
                "scopes_granted": c.scopes_granted
            })
        else:
            response.append({
                "server_type": server_type.value,
                "url": "",
                "status": "disconnected",
                "last_verified_at": None,
                "scopes_granted": None
            })
            
    return response

@router.post("/{server_type}/connect")
def connect_mcp_server(
    server_type: str, 
    request: McpConnectRequest, 
    db: Session = Depends(get_db), 
    current_admin: User = Depends(require_admin)
):
    """Creates or updates an MCP connection and attempts to verify it."""
    try:
        mcp_type = McpServerType(server_type)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid server type")
        
    connection = db.query(McpConnection).filter(
        McpConnection.org_id == current_admin.org_id,
        McpConnection.mcp_server_type == mcp_type
    ).first()
    
    encrypted_creds = encrypt_credentials(request.credentials) if request.credentials else None
    
    if connection:
        connection.mcp_server_url = request.url
        if encrypted_creds:
            connection.auth_credentials_encrypted = encrypted_creds
        connection.status = McpConnectionStatus.active
        connection.connected_by_user_id = current_admin.id
    else:
        connection = McpConnection(
            org_id=current_admin.org_id,
            mcp_server_type=mcp_type,
            mcp_server_url=request.url,
            auth_credentials_encrypted=encrypted_creds,
            connected_by_user_id=current_admin.id,
            status=McpConnectionStatus.active
        )
        db.add(connection)
        
    db.commit()
    db.refresh(connection)
    
    # Try to verify the connection
    mcp_client_manager.verify_connection(connection, db)
    db.refresh(connection)
    
    return {"message": "Connected", "status": connection.status.value}

@router.post("/{server_type}/verify")
def verify_mcp_server(
    server_type: str, 
    db: Session = Depends(get_db), 
    current_admin: User = Depends(require_admin)
):
    """Manually pings the MCP server to verify connectivity."""
    try:
        mcp_type = McpServerType(server_type)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid server type")
        
    connection = db.query(McpConnection).filter(
        McpConnection.org_id == current_admin.org_id,
        McpConnection.mcp_server_type == mcp_type
    ).first()
    
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")
        
    status = mcp_client_manager.verify_connection(connection, db)
    return {"message": "Verified", "status": status.value}

@router.delete("/{server_type}")
def disconnect_mcp_server(
    server_type: str, 
    db: Session = Depends(get_db), 
    current_admin: User = Depends(require_admin)
):
    """Disconnects and removes the MCP server from the org."""
    try:
        mcp_type = McpServerType(server_type)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid server type")
        
    connection = db.query(McpConnection).filter(
        McpConnection.org_id == current_admin.org_id,
        McpConnection.mcp_server_type == mcp_type
    ).first()
    
    if not connection:
        return {"message": "Already disconnected"}
        
    mcp_client_manager.disconnect(connection, db)
    db.delete(connection)
    db.commit()
    
    return {"message": "Disconnected"}

class McpScopesRequest(BaseModel):
    scopes: List[str]

@router.patch("/{server_type}/scopes")
def update_mcp_scopes(
    server_type: str, 
    request: McpScopesRequest, 
    db: Session = Depends(get_db), 
    current_admin: User = Depends(require_admin)
):
    """Updates the tool-level scopes granted to this MCP connection (FR-ADM-4)."""
    import json
    try:
        mcp_type = McpServerType(server_type)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid server type")
        
    connection = db.query(McpConnection).filter(
        McpConnection.org_id == current_admin.org_id,
        McpConnection.mcp_server_type == mcp_type
    ).first()
    
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")
        
    connection.scopes_granted = json.dumps(request.scopes)
    db.commit()
    db.refresh(connection)
    
    return {"message": "Scopes updated", "scopes_granted": connection.scopes_granted}
