# Runbook: backend restart loop

## Symptom
`docker compose ps` shows `apiblueprint_backend` continuously `Restarting`, or the
frontend can't reach the API. `restart: unless-stopped` keeps relaunching a
process that exits on startup.

## Diagnose
```bash
docker compose logs --tail=120 backend
```
Look at the last lines before each exit. Common causes:

- **Missing/invalid required env var.** `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and
  `JWT_SECRET` are required (no defaults) — pydantic-settings raises on boot if
  unset. Symptom: `ValidationError` / `field required`.
- **Database not reachable at startup.** The backend depends on `db` being
  healthy; if Postgres is down or credentials are wrong, queries fail. Symptom:
  `OperationalError` / `could not connect`.
- **Redis URL set but Redis down.** Rate limiting uses `REDIS_URL`. The spec cache
  degrades gracefully, but a bad `REDIS_URL` can surface on first limited request.
- **Bad migration / import error.** A syntax error or failed import. Symptom: a
  Python traceback rather than an app log line.

## Fix
- Missing env: confirm `.env` exists and is complete (compare with `.env.example`),
  then `docker compose up -d backend`.
- DB unreachable: `docker compose ps db`; if unhealthy, `docker compose logs db`,
  fix credentials/volume, `docker compose up -d db` and wait for healthy.
- Redis: unset `REDIS_URL` to fall back to in-process stores, or fix the URL and
  restart Redis.
- Import/migration error: fix the code/migration, rebuild: `docker compose up -d --build backend`.

## Verify
```bash
curl -s localhost:8000/health/ready   # expect {"status":"ok","db":"reachable"}
```

## Prevent
- Keep `.env` in sync with `.env.example`; required vars fail fast by design.
- CI runs the test suite (incl. app boot) on every push.
- `/health/ready` is wired into external uptime monitoring (see [../slo.md](../slo.md)).
