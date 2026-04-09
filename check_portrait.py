import sqlite3

import os

# Используем относительный путь, который работает как из корня, так и из папки backend
if os.path.exists("backend/data/archon.db"):
    db_path = "backend/data/archon.db"
elif os.path.exists("data/archon.db"):
    db_path = "data/archon.db"
else:
    # По умолчанию для нового запуска
    db_path = "backend/data/archon.db"

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

cursor.execute("SELECT id, name, portrait_image_path FROM characters WHERE id = 1")
row = cursor.fetchone()
if row:
    print(f"Character ID: {row[0]}")
    print(f"Name: {row[1]}")
    print(f"portrait_image_path: '{row[2]}'")
    print(f"Length: {len(row[2]) if row[2] else 'None'}")
else:
    print("Character with id=1 not found")

conn.close()