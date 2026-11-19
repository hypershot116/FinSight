from sqlalchemy import inspect, text
from database import engine


def run_migration():
    print(f"Connected dialect: {engine.dialect.name} ({engine.url.host or engine.url.database})")
    inspector = inspect(engine)
    existing_columns = {col["name"] for col in inspector.get_columns("users")}

    for col_name in ("is_admin", "is_master_admin"):
        if col_name in existing_columns:
            print(f"Column '{col_name}' already exists. Skipping.")
            continue
        with engine.begin() as conn:
            conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} BOOLEAN NOT NULL DEFAULT FALSE;"))
            print(f"Added column '{col_name}' to users table.")

    print("Migration complete.")


if __name__ == "__main__":
    run_migration()
