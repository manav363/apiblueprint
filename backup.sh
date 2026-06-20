#!/usr/bin/env bash
# backup.sh — nightly pg_dump for APIBlueprint
#
# Usage:
#   ./backup.sh
#   BACKUP_DIR=/mnt/backups ./backup.sh
#
# Schedule with cron (daily at 2am):
#   0 2 * * * /path/to/apiblueprint/backup.sh >> /var/log/apiblueprint-backup.log 2>&1

set -euo pipefail

# ── Config ─────────────────────────────────────────────────────────────────────
BACKUP_DIR="${BACKUP_DIR:-./backups}"
DB_CONTAINER="${DB_CONTAINER:-apiblueprint_db}"
POSTGRES_USER="${POSTGRES_USER:-apiblueprint}"
POSTGRES_DB="${POSTGRES_DB:-apiblueprint}"
RETAIN_DAYS="${RETAIN_DAYS:-7}"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/apiblueprint_${TIMESTAMP}.sql.gz"

# ── Run ────────────────────────────────────────────────────────────────────────
mkdir -p "${BACKUP_DIR}"

echo "[backup] $(date -u +"%Y-%m-%dT%H:%M:%SZ") starting pg_dump → ${BACKUP_FILE}"

docker exec "${DB_CONTAINER}" \
    pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" \
    | gzip > "${BACKUP_FILE}"

SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "[backup] Done. Size: ${SIZE}"

# ── Prune ──────────────────────────────────────────────────────────────────────
echo "[backup] Removing backups older than ${RETAIN_DAYS} days..."
find "${BACKUP_DIR}" -name "apiblueprint_*.sql.gz" -mtime +"${RETAIN_DAYS}" -delete

echo "[backup] Current backups:"
ls -lh "${BACKUP_DIR}" | grep "apiblueprint_" || echo "  (none)"
