import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()
engine = create_engine(os.getenv("DATABASE_URL"))

migrations = [
    "ALTER TABLE leads ADD COLUMN IF NOT EXISTS job_title VARCHAR;",
    "ALTER TABLE leads ADD COLUMN IF NOT EXISTS location VARCHAR;",
    "ALTER TABLE leads ADD COLUMN IF NOT EXISTS industry VARCHAR;",
    "ALTER TABLE leads ADD COLUMN IF NOT EXISTS linkedin_url VARCHAR;",
    "ALTER TABLE leads ADD COLUMN IF NOT EXISTS email VARCHAR;",
    "ALTER TABLE leads ADD COLUMN IF NOT EXISTS company VARCHAR;",
    "ALTER TABLE leads ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();",
]

with engine.connect() as conn:
    for sql in migrations:
        conn.execute(text(sql))
        print(f"OK: {sql.strip()}")
    conn.commit()

    rows = conn.execute(text(
        "SELECT column_name, data_type FROM information_schema.columns "
        "WHERE table_name='leads' ORDER BY ordinal_position"
    ))
    print("\nFinal leads table schema:")
    for r in rows:
        print(f"  {r[0]}: {r[1]}")
