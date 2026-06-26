#!/usr/bin/env bash
#
# Cold-clone smoke test: build and start the full stack with docker compose,
# wait for every service to become healthy, and assert the key endpoints respond.
# Mirrors what a brand-new clone of the repo should do on first `compose up`.
#
# Usage:
#   scripts/smoke-test.sh           # build, test, then tear down
#   KEEP=1 scripts/smoke-test.sh    # leave the stack running afterwards
#
set -euo pipefail

cd "$(dirname "$0")/.."

ENV_FILE=".env.smoke"
TIMEOUT="${TIMEOUT:-180}"   # seconds to wait for the stack to come up

# Use a dedicated high port range so the smoke test never collides with a dev
# stack, a local Postgres, or a local Redis already bound to the defaults.
SMOKE_BACKEND_PORT="${SMOKE_BACKEND_PORT:-18000}"
SMOKE_FRONTEND_PORT="${SMOKE_FRONTEND_PORT:-15173}"
SMOKE_MOCK_PORT="${SMOKE_MOCK_PORT:-14010}"
SMOKE_POSTGRES_PORT="${SMOKE_POSTGRES_PORT:-15432}"
SMOKE_REDIS_PORT="${SMOKE_REDIS_PORT:-16379}"

BACKEND="http://localhost:${SMOKE_BACKEND_PORT}"
FRONTEND="http://localhost:${SMOKE_FRONTEND_PORT}"
MOCK="http://localhost:${SMOKE_MOCK_PORT}"

cleanup() {
  if [[ "${KEEP:-0}" != "1" ]]; then
    echo "[smoke] Tearing down..."
    docker compose --env-file "$ENV_FILE" down -v >/dev/null 2>&1 || true
    rm -f "$ENV_FILE"
  else
    echo "[smoke] KEEP=1 — leaving the stack running."
  fi
}
trap cleanup EXIT

echo "[smoke] Writing throwaway env ($ENV_FILE)..."
cat > "$ENV_FILE" <<EOF
POSTGRES_USER=apiblueprint
POSTGRES_PASSWORD=smoke-test-password-not-secret
POSTGRES_DB=apiblueprint
ADMIN_USERNAME=admin
ADMIN_PASSWORD=smoke-test-admin-not-secret
JWT_SECRET=smoke-test-jwt-secret-at-least-32-characters
DATABASE_URL=postgresql://apiblueprint:smoke-test-password-not-secret@db:5432/apiblueprint
ENABLE_API_DOCS=true
BACKEND_PORT=${SMOKE_BACKEND_PORT}
FRONTEND_PORT=${SMOKE_FRONTEND_PORT}
MOCK_PORT=${SMOKE_MOCK_PORT}
POSTGRES_PORT=${SMOKE_POSTGRES_PORT}
REDIS_PORT=${SMOKE_REDIS_PORT}
EOF

echo "[smoke] Building and starting the stack (this can take a few minutes)..."
docker compose --env-file "$ENV_FILE" up -d --build

# Wait for an HTTP endpoint to return 2xx/3xx, or fail after TIMEOUT.
wait_for() {
  local name="$1" url="$2" deadline=$(( $(date +%s) + TIMEOUT ))
  echo -n "[smoke] Waiting for $name ($url) "
  while true; do
    if curl -fsS -o /dev/null "$url" 2>/dev/null; then
      echo " up"
      return 0
    fi
    if [[ $(date +%s) -ge $deadline ]]; then
      echo " TIMEOUT"
      echo "[smoke] FAILED: $name did not become healthy in ${TIMEOUT}s" >&2
      docker compose --env-file "$ENV_FILE" ps
      docker compose --env-file "$ENV_FILE" logs --tail=50
      return 1
    fi
    echo -n "."
    sleep 3
  done
}

wait_for "backend liveness" "$BACKEND/health/live"
wait_for "backend readiness" "$BACKEND/health/ready"
wait_for "mock server" "$MOCK/health"
wait_for "frontend" "$FRONTEND/"

echo "[smoke] Asserting responses..."
ready_body=$(curl -fsS "$BACKEND/health/ready")
echo "[smoke]   /health/ready -> $ready_body"
case "$ready_body" in
  *'"db"'*'"reachable"'*) ;;
  *) echo "[smoke] FAILED: readiness did not report db reachable" >&2; exit 1 ;;
esac

# Auth works end to end.
token=$(curl -fsS -X POST "$BACKEND/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"smoke-test-admin-not-secret"}' \
  | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')
if [[ -z "$token" ]]; then
  echo "[smoke] FAILED: could not obtain an auth token" >&2
  exit 1
fi
echo "[smoke]   login -> token acquired"

# Authenticated read.
curl -fsS -o /dev/null "$BACKEND/api/v1/projects" -H "Authorization: Bearer $token"
echo "[smoke]   GET /api/v1/projects -> 200"

echo "[smoke] PASS — full stack is healthy."
