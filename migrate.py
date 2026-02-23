import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()
engine = create_engine(os.getenv("DATABASE_URL"))

migrations = [
    # Existing columns (safe to re-run)
    "ALTER TABLE leads ADD COLUMN IF NOT EXISTS job_title VARCHAR;",
    "ALTER TABLE leads ADD COLUMN IF NOT EXISTS location VARCHAR;",
    "ALTER TABLE leads ADD COLUMN IF NOT EXISTS industry VARCHAR;",
    "ALTER TABLE leads ADD COLUMN IF NOT EXISTS linkedin_url VARCHAR;",
    "ALTER TABLE leads ADD COLUMN IF NOT EXISTS email VARCHAR;",
    "ALTER TABLE leads ADD COLUMN IF NOT EXISTS company VARCHAR;",
    "ALTER TABLE leads ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();",
    # New columns
    "ALTER TABLE leads ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'New';",
    "ALTER TABLE leads ADD COLUMN IF NOT EXISTS notes TEXT;",
]

with engine.connect() as conn:
    for sql in migrations:
        conn.execute(text(sql))
        print(f"OK: {sql.strip()}")

    # Remove duplicate linkedin_url rows (keep lowest id) before creating unique index
    conn.execute(text("""
        DELETE FROM leads
        WHERE id NOT IN (
            SELECT MIN(id) FROM leads
            WHERE linkedin_url IS NOT NULL
            GROUP BY linkedin_url
        )
        AND linkedin_url IS NOT NULL;
    """))
    print("OK: deduplicated existing linkedin_url rows")

    # Unique index on linkedin_url (only for non-null values)
    conn.execute(text("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_leads_linkedin_url
        ON leads (linkedin_url)
        WHERE linkedin_url IS NOT NULL;
    """))
    print("OK: unique index on linkedin_url")

    conn.commit()

    rows = conn.execute(text(
        "SELECT column_name, data_type FROM information_schema.columns "
        "WHERE table_name='leads' ORDER BY ordinal_position"
    ))
    print("\nFinal leads table schema:")
    for r in rows:
        print(f"  {r[0]}: {r[1]}")
