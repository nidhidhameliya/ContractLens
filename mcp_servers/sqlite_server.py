import sqlite3
import json
from mcp.server.mcpserver import MCPServer

# Create a MCPServer server
mcp = MCPServer("Usage DB Server")

@mcp.tool()
def get_vendor_usage(vendor_name: str) -> str:
    """Fetch the number of active users and licensed seats for a specific software vendor from the corporate database."""
    conn = sqlite3.connect('usage_data.db')
    cursor = conn.cursor()
    
    # We use a loose LIKE match so "Salesforce" matches "Salesforce, Inc."
    cursor.execute("SELECT licensed_seats, active_users FROM software_usage WHERE vendor_name LIKE ?", (f"%{vendor_name}%",))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return json.dumps({
            "vendor": vendor_name,
            "licensed_seats": row[0],
            "active_users": row[1],
            "utilization_pct": round((row[1] / row[0]) * 100, 2)
        })
    return json.dumps({"error": f"No usage data found for vendor: {vendor_name}"})

if __name__ == "__main__":
    # This automatically handles the stdio transport protocol required by MCP!
    mcp.run()
