import sqlite3

def seed_db():
    conn = sqlite3.connect('usage_data.db')
    cursor = conn.cursor()
    
    # Create table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS software_usage (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vendor_name TEXT UNIQUE NOT NULL,
            licensed_seats INTEGER NOT NULL,
            active_users INTEGER NOT NULL
        )
    ''')
    
    # Insert mock data
    mock_data = [
        ("Salesforce", 100, 85),
        ("Zoom", 500, 490),
        ("Slack", 200, 195),
        ("Figma", 50, 10),
        ("Acme Corp", 100, 0), # Fully deactivated for verification testing
        ("Notion", 100, 2),    # Low usage
        ("DataDog", 20, 20),
    ]
    
    cursor.executemany('''
        INSERT OR REPLACE INTO software_usage (vendor_name, licensed_seats, active_users)
        VALUES (?, ?, ?)
    ''', mock_data)
    
    conn.commit()
    conn.close()
    print("Successfully seeded usage_data.db with mock vendor data.")

if __name__ == "__main__":
    seed_db()
