import sqlite3

conn = sqlite3.connect('usage_data.db')
conn.execute('CREATE TABLE IF NOT EXISTS software_usage (vendor_name TEXT PRIMARY KEY, licensed_seats INTEGER, active_users INTEGER)')
conn.execute('DELETE FROM software_usage') # Clear if exists
conn.execute("INSERT INTO software_usage VALUES ('Salesforce, Inc.', 500, 150)")
conn.execute("INSERT INTO software_usage VALUES ('Slack Technologies', 1000, 950)")
conn.commit()
print("Database created successfully!")
