from database import engine
from sqlalchemy import text

def run_migration():
    with engine.begin() as conn:
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN name VARCHAR;"))
            conn.execute(text("ALTER TABLE users ADD COLUMN location VARCHAR;"))
            # Make existing accounts active by default so you don't lock yourself out of your test account
            conn.execute(text("ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT TRUE;"))
            conn.execute(text("ALTER TABLE users ADD COLUMN otp_code VARCHAR;"))
            print("Migration successful! Existing data preserved.")
        except Exception as e:
            print(f"Migration check: Columns likely already exist. ({e})")

if __name__ == "__main__":
    run_migration()
