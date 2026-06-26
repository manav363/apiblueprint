#!/usr/bin/env bash
#
# Purge the CDN edge cache for the unhashed, revalidatable spec URLs after a
# deploy. Content-addressed URLs (/projects/{id}/spec/{hash}.json) are immutable
# and never need purging — only the short-lived /spec.json and /spec endpoints do.
#
# Provider-agnostic via env vars; the example below targets Cloudflare. If the
# required secrets aren't set, this is a no-op (so it's safe to wire into CI
# before a CDN exists).
#
# Required (Cloudflare example):
#   CDN_PROVIDER=cloudflare
#   CF_ZONE_ID=...
#   CF_API_TOKEN=...        (Zone.Cache Purge permission)
# Optional:
#   PURGE_PREFIXES="https://api.example.com/api/v1/"   # space-separated
#
set -euo pipefail

PROVIDER="${CDN_PROVIDER:-}"

if [[ -z "$PROVIDER" ]]; then
  echo "[cdn-purge] CDN_PROVIDER not set — skipping (no CDN configured)."
  exit 0
fi

case "$PROVIDER" in
  cloudflare)
    : "${CF_ZONE_ID:?CF_ZONE_ID required for cloudflare}"
    : "${CF_API_TOKEN:?CF_API_TOKEN required for cloudflare}"

    if [[ -n "${PURGE_PREFIXES:-}" ]]; then
      # Purge specific prefixes.
      prefixes_json=$(printf '"%s",' $PURGE_PREFIXES)
      body="{\"prefixes\":[${prefixes_json%,}]}"
    else
      # Default: purge everything in the zone.
      body='{"purge_everything":true}'
    fi

    echo "[cdn-purge] Purging Cloudflare zone ${CF_ZONE_ID}..."
    curl -sf -X POST \
      "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache" \
      -H "Authorization: Bearer ${CF_API_TOKEN}" \
      -H "Content-Type: application/json" \
      --data "$body" >/dev/null
    echo "[cdn-purge] Done."
    ;;

  *)
    echo "[cdn-purge] Unknown CDN_PROVIDER='$PROVIDER'. Supported: cloudflare." >&2
    exit 1
    ;;
esac
