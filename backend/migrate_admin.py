from database import engine
from sqlalchemy import text

def run_migration():
    with engine.begin() as conn:
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;"))
            print("Migration successful! is_admin column added.")
        except Exception as e:
            print(f"Migration check: Column likely already exists. ({e})")

if __name__ == "__main__":
    run_migration()
