# Runbook: database migration failure

## Symptom
`alembic upgrade head` (or `make migrate`) fails, or the backend errors with
`relation "..." does not exist` / `column "..." does not exist` after a deploy —
the schema is out of sync with the code.

## Diagnose
```bash
docker compose exec backend alembic current   # current revision
docker compose exec backend alembic heads      # expected head(s)
docker compose exec backend alembic history --verbose | head
```
Common causes:

- **Migration not applied.** `current` is behind `head` — the upgrade never ran.
- **Migration error mid-run.** A migration raised (e.g. creating an index that
  already exists, or a non-nullable column on existing rows) and left the DB
  partially migrated.
- **Divergent heads.** Two migrations share the same `down_revision`, so Alembic
  can't pick a single head.
- **Drift from manual changes.** The DB was altered by hand and no longer matches
  the migration chain.

## Fix
- Not applied: `docker compose exec backend alembic upgrade head`.
- Errored migration: read the traceback, fix the migration script, then re-run.
  For an "already exists" index, make the migration idempotent or downgrade one
  step (`alembic downgrade -1`) and re-apply.
- Divergent heads: `alembic merge -m "merge heads" <rev1> <rev2>`, then upgrade.
- **Never** edit an already-applied migration in place — add a new one.

## Recovery (non-production data)
If a dev database is wedged, recreate it from migrations:
```bash
docker compose down
docker volume rm apiblueprint_postgres_data   # destroys local data
docker compose up -d db
docker compose exec backend alembic upgrade head
make seed    # optional sample data
```
For production, restore from the nightly `pg_dump` backup (`backup.sh`) before
re-applying migrations.

## Verify
```bash
docker compose exec backend alembic current    # equals alembic heads
curl -s localhost:8000/health/ready            # {"status":"ok","db":"reachable"}
```

## Prevent
- One head per branch; merge promptly when branches add migrations.
- Test migrations on a copy before production; keep `backup.sh` running nightly.
- Make schema-only migrations (like `20260625_000002_performance_indexes`)
  idempotent where practical.
