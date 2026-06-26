# Deployment Guide

Step-by-step instructions to go from a bare server to a running APIBlueprint stack.
Follow these in order. A fresh Ubuntu 22.04 LTS server is assumed.

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Docker Engine | 24+ | https://docs.docker.com/engine/install/ubuntu/ |
| Docker Compose v2 | 2.20+ | Bundled with Docker Engine |
| Git | any | `sudo apt install git` |

Verify:
```bash
docker --version
docker compose version
git --version
```

---

## 1. Clone the Repository

```bash
git clone https://github.com/manav/APIBlueprint.git
cd apiblueprint
```

---

## 2. Configure Environment

```bash
cp .env.example .env
```

Open `.env` and set every required value:

| Variable | What to set |
|---|---|
| `POSTGRES_PASSWORD` | Strong random password — `openssl rand -hex 32` |
| `ADMIN_USERNAME` | Your admin login username |
| `ADMIN_PASSWORD` | Strong admin password |
| `JWT_SECRET` | Random secret — `openssl rand -hex 32` |
| `CORS_ORIGINS` | `["https://your-domain.com"]` in production |

Leave optional variables at their defaults unless you know what they do.

---

## 3. Build and Start

```bash
docker compose up --build -d
```

This will:
1. Build multi-stage Docker images for backend, frontend, and mock
2. Start PostgreSQL and wait until it is healthy
3. Run Alembic migrations automatically
4. Start all four services

---

## 4. Verify the Stack

```bash
docker compose ps
```

All four services should show `running`:

| Service | Port | Expected |
|---|---|---|
| `db` | 5432 | `healthy` |
| `backend` | 8000 | `running` |
| `mock` | 4010 | `running` |
| `frontend` | 5173 | `running` |

Check health endpoints:

```bash
curl http://localhost:8000/health/live   # → {"status":"ok"}
curl http://localhost:8000/health/ready  # → {"status":"ok","db":"reachable"}
curl http://localhost:4010/health        # → {"status":"ok",...}
```

Open the app: http://localhost:5173

---

## 5. Seed Sample Data (Optional)

```bash
make seed
```

Creates one sample project ("Petstore API") with 3 endpoints and a schema so
the UI is not empty on first load.

---

## 6. Set Up Nightly Backups

Add a cron job to run `backup.sh` daily:

```bash
crontab -e
```

Add this line (runs at 2am every day):

```
0 2 * * * /path/to/apiblueprint/backup.sh >> /var/log/apiblueprint-backup.log 2>&1
```

Backups are written to `./backups/` and kept for 7 days by default.
Change `RETAIN_DAYS` in `.env` or export it before running the script to adjust retention.

---

## 7. Configure Firewall

The compose file binds all ports to `127.0.0.1`, so services are not exposed
to the internet by default. If you put a reverse proxy (Nginx, Caddy) in front,
only expose ports 80 and 443 externally:

```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP (for HTTPS redirect)
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

---

## 8. CDN / Edge Caching (optional)

Generated OpenAPI specs are cache-friendly:

- **`GET /api/v1/projects/{id}/spec.json`** (and `/spec`) return an `ETag` (the
  spec's content hash) and `Cache-Control: public, max-age=60`. A CDN or browser
  revalidates with `If-None-Match` and gets a cheap `304 Not Modified` when
  nothing changed. The response also carries a `Content-Location` header pointing
  at the immutable copy below.
- **`GET /api/v1/projects/{id}/spec/{hash}.json`** is content-addressed and
  immutable: `Cache-Control: public, max-age=31536000, immutable`. Because the
  URL changes whenever the spec changes, the edge can cache it for a year with no
  invalidation. A stale hash returns `404`.

### Putting a CDN in front

Point the CDN at the backend origin and let it honor the `Cache-Control`/`ETag`
headers above — no special rules needed. The immutable hashed URLs never need
purging; only the short-lived `/spec.json` and `/spec` endpoints do, and their
60s max-age means they self-heal quickly.

### Purge on deploy

`scripts/cdn-purge.sh` purges the revalidatable URLs (Cloudflare example,
provider-agnostic via env vars). It is wired into `.github/workflows/deploy.yml`,
which runs on a published release. It **no-ops safely** until you configure:

- Repo variable `CDN_PROVIDER` (e.g. `cloudflare`) and optional `PURGE_PREFIXES`
- Repo secrets `CF_ZONE_ID`, `CF_API_TOKEN`

Run it manually too:

```bash
CDN_PROVIDER=cloudflare CF_ZONE_ID=... CF_API_TOKEN=... bash scripts/cdn-purge.sh
```

---

## Day-to-Day Operations

### View logs
```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f mock
```

### Stop
```bash
docker compose down
```

### Restart after code changes
```bash
docker compose up --build -d
```

### Run migrations manually
```bash
make migrate
```

### Wipe everything and start fresh
```bash
make clean        # removes containers + volumes (data is lost)
make setup        # rebuild
```

---

## Troubleshooting

**Backend keeps restarting**
```bash
docker compose logs backend --tail 100
```
Most common cause: wrong `DATABASE_URL` or missing `.env` variable.

**Mock returns 404 on every route**

Reload mock routes after creating or changing endpoints:
```bash
curl -X POST http://localhost:4010/mock/reload/<project_id>
```
Or use the Monitoring page in the UI.

**Frontend blank screen after login**

Check the browser console for `ERR_CONNECTION_REFUSED` — likely `VITE_API_URL`
or `VITE_MOCK_URL` point to the wrong address.

**Database migration failed**
```bash
docker compose exec backend alembic current   # check current revision
docker compose exec backend alembic upgrade head
```

**Clean reset (destroys all data)**
```bash
make clean && make setup
```
