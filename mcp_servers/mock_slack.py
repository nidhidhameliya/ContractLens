import json
import datetime
from mcp.server.mcpserver import MCPServer

mcp = MCPServer("Mock Slack Server")

def _log_slack(channel: str, message: str):
    """Writes the Slack message to a local file to simulate sending."""
    timestamp = datetime.datetime.now().isoformat()
    log_entry = f"[{timestamp}] [Channel: {channel}]\n{message}\n{'-'*40}\n"
    
    with open("slack_outbox.log", "a", encoding="utf-8") as f:
        f.write(log_entry)

@mcp.tool()
def post_message(channel: str, message: str) -> str:
    """Posts a message to a Slack channel."""
    _log_slack(channel, message)
    return json.dumps({"status": "success", "channel": channel, "ts": str(datetime.datetime.now().timestamp())})

@mcp.tool()
def send_dm(user_email: str, message: str) -> str:
    """Sends a direct message to a Slack user via their email."""
    _log_slack(f"DM to {user_email}", message)
    return json.dumps({"status": "success", "user": user_email, "ts": str(datetime.datetime.now().timestamp())})

if __name__ == "__main__":
    mcp.run()
