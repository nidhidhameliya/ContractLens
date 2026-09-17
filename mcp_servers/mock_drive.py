import os
import json
from mcp.server.mcpserver import MCPServer

mcp = MCPServer("Mock Drive DB Server")

# A small static registry of files for demo purposes
MOCK_DRIVE = [
    {
        "id": "file-101",
        "name": "AcmeCorp_Slack_Enterprise_2026.txt",
        "content": "This is a contract for Slack Enterprise. Vendor: Slack. Renewal Date: 2026-12-01. Notice Period: 30 days. Auto-renew: Yes. Seats: 1000. Price: $120,000 per year."
    },
    {
        "id": "file-102",
        "name": "Zendesk_Support_MSA.txt",
        "content": "This is a contract for Zendesk Support. Vendor: Zendesk. Renewal Date: 2026-11-15. Notice Period: 60 days. Auto-renew: Yes. Seats: 50. Price: $45,000 per year."
    }
]

@mcp.tool()
def list_files(query: str) -> str:
    """Lists files in the mock drive that match the query."""
    results = [{"id": f["id"], "name": f["name"]} for f in MOCK_DRIVE]
    return json.dumps(results)

@mcp.tool()
def read_file(file_id: str) -> str:
    """Reads the content of a file by ID."""
    for f in MOCK_DRIVE:
        if f["id"] == file_id:
            return json.dumps({"content": f["content"], "name": f["name"]})
    return json.dumps({"error": "File not found"})

if __name__ == "__main__":
    mcp.run()
