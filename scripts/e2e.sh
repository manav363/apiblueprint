#!/usr/bin/env bash
#
# Run the Playwright end-to-end suite against the full docker-compose stack.
# Brings the stack up on its default ports (so the browser reaches the API at the
# URLs the frontend was built with), waits for health, runs the suite, tears down.
#
# Redis is remapped to a non-default host port to avoid colliding with a local
# Redis; the backend still reaches it in-network at redis://redis:6379.
#
# Usage:
#   scripts/e2e.sh            # up, test, down
#   KEEP=1 scripts/e2e.sh     # leave the stack running afterwards
#
set -euo pipefail

cd "$(dirname "$0")/.."

ENV_FILE=".env.e2e"
TIMEOUT="${TIMEOUT:-180}"
ADMIN_PASSWORD="e2e-admin-not-secret"

cleanup() {
  if [[ "${KEEP:-0}" != "1" ]]; then
    echo "[e2e] Tearing down..."
    docker compose --env-file "$ENV_FILE" down -v >/dev/null 2>&1 || true
    rm -f "$ENV_FILE"
  fi
}
trap cleanup EXIT

cat > "$ENV_FILE" <<EOF
POSTGRES_USER=apiblueprint
POSTGRES_PASSWORD=e2e-db-not-secret
POSTGRES_DB=apiblueprint
ADMIN_USERNAME=admin
ADMIN_PASSWORD=${ADMIN_PASSWORD}
JWT_SECRET=e2e-jwt-secret-at-least-32-characters-long
DATABASE_URL=postgresql://apiblueprint:e2e-db-not-secret@db:5432/apiblueprint
POSTGRES_PORT=5433
REDIS_PORT=6380
EOF

echo "[e2e] Building and starting the stack..."
docker compose --env-file "$ENV_FILE" up -d --build

wait_for() {
  local name="$1" url="$2" deadline=$(( $(date +%s) + TIMEOUT ))
  echo -n "[e2e] Waiting for $name "
  while ! curl -fsS -o /dev/null "$url" 2>/dev/null; do
    if [[ $(date +%s) -ge $deadline ]]; then
      echo " TIMEOUT"
      docker compose --env-file "$ENV_FILE" logs --tail=50
      exit 1
    fi
    echo -n "."
    sleep 3
  done
  echo " up"
}

wait_for "backend" "http://localhost:8000/health/ready"
wait_for "mock" "http://localhost:4010/health"
wait_for "frontend" "http://localhost:5173/"

echo "[e2e] Running Playwright..."
(
  cd frontend
  npx playwright install chromium >/dev/null 2>&1 || true
  E2E_BASE_URL="http://localhost:5173" \
  E2E_ADMIN_USERNAME="admin" \
  E2E_ADMIN_PASSWORD="${ADMIN_PASSWORD}" \
    npm run e2e
)

echo "[e2e] PASS"
