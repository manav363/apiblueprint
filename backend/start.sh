#!/bin/sh
set -e

NEEDS_STAMP="$(python - <<'PY'
import os
from sqlalchemy import create_engine, inspect

database_url = os.environ["DATABASE_URL"]
engine = create_engine(database_url)
inspector = inspect(engine)
tables = set(inspector.get_table_names())
app_tables = {"projects", "endpoints", "parameters", "responses", "schemas", "schema_fields"}

print("1" if (tables & app_tables and "alembic_version" not in tables) else "0")
PY
)"

if [ "$NEEDS_STAMP" = "1" ]; then
  echo "[Startup] Existing schema detected without Alembic history. Stamping head."
  alembic stamp head
fi

alembic upgrade head
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
