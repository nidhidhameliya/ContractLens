import logging
from app.mcp_integration.client_manager import mcp_client_manager
from app.mcp_integration.mcp_connection import McpServerType
from app.core.database import SessionLocal
import json

logger = logging.getLogger(__name__)

def _get_slack_client(org_id: str):
    db = SessionLocal()
    try:
        return mcp_client_manager.get_client(org_id, McpServerType.slack, db)
    except Exception as e:
        logger.error(f"Failed to get Slack MCP Client: {e}")
        return None
    finally:
        db.close()

def send_slack_approval_request(org_id: str, contract_id: str, decision_details: dict):
    """Sends a notification to a Slack channel via MCP that an action requires approval."""
    client = _get_slack_client(org_id)
    if not client:
        return
        
    vendor = decision_details.get("vendor_name", "Unknown Vendor")
    action = decision_details.get("recommended_action", "")
    savings = decision_details.get("expected_savings", 0)
    
    msg = f"""*High-Risk Contract Detected: {vendor}* :warning:
    
The Termora AI pipeline has recommended an action that requires human approval.
*Recommended Action*: {action.upper()}
*Estimated Savings*: ${savings:,.2f}

<http://localhost:3000/contracts/{contract_id}|Click here to review the agent reasoning trail and approve>"""

    try:
        logger.info(f"Sending Slack approval request for contract {contract_id} via MCP.")
        client.call_tool("post_message", {"channel": "#finance-approvals", "message": msg})
    except Exception as e:
        logger.error(f"Failed to post Slack approval request: {e}")

def send_slack_action_draft(org_id: str, action_details: dict):
    """Sends an automated action summary into Slack after an action is approved."""
    client = _get_slack_client(org_id)
    if not client:
        return
        
    contract_id = action_details.get("contract_id", "")
    type = action_details.get("type", "")
    
    msg = f"""*Termora Action Executed* :white_check_mark:
    
A {type.upper()} action was just approved and executed for contract `{contract_id}`.
The outcome verification job will automatically check this vendor's usage in 30 days to confirm the financial impact.
"""

    try:
        logger.info(f"Sending Slack action draft for contract {contract_id} via MCP.")
        client.call_tool("post_message", {"channel": "#finance-logs", "message": msg})
    except Exception as e:
        logger.error(f"Failed to post Slack action draft: {e}")
