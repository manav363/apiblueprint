"""A tiny JSON cache with a Redis backend and an in-process fallback.

When ``REDIS_URL`` is configured the cache is shared across processes via Redis;
otherwise it degrades to a process-local dict with TTL expiry, so the app runs
identically (just without cross-process sharing) when Redis isn't available.

Values are JSON-serializable. Keys for the OpenAPI spec are content-addressed —
``spec:{project_id}:{content_hash}`` — so any mutation that changes a project's
graph produces a new key, which is how the spec cache is invalidated on change.
"""

import json
import time
from typing import Any

from .config import settings
from .logging import get_logger

logger = get_logger("cache")


class _InProcessCache:
    """Process-local dict cache with per-key expiry. Used when Redis is absent."""

    def __init__(self) -> None:
        self._store: dict[str, tuple[float | None, str]] = {}

    def get(self, key: str) -> Any | None:
        entry = self._store.get(key)
        if entry is None:
            return None
        expires_at, raw = entry
        if expires_at is not None and expires_at < time.monotonic():
            self._store.pop(key, None)
            return None
        return json.loads(raw)

    def set(self, key: str, value: Any, ttl_seconds: int | None = None) -> None:
        expires_at = time.monotonic() + ttl_seconds if ttl_seconds else None
        self._store[key] = (expires_at, json.dumps(value))

    def delete_prefix(self, prefix: str) -> None:
        for key in [k for k in self._store if k.startswith(prefix)]:
            self._store.pop(key, None)

    def clear(self) -> None:
        self._store.clear()


class _RedisCache:
    """Redis-backed cache. Falls back to no-op on connection errors so a Redis
    outage degrades to "cache miss" rather than failing the request."""

    def __init__(self, client: Any) -> None:
        self._client = client

    def get(self, key: str) -> Any | None:
        try:
            raw = self._client.get(key)
        except Exception as exc:  # pragma: no cover - depends on live Redis
            logger.warning("cache_get_failed", error=str(exc))
            return None
        return json.loads(raw) if raw else None

    def set(self, key: str, value: Any, ttl_seconds: int | None = None) -> None:
        try:
            self._client.set(key, json.dumps(value), ex=ttl_seconds or None)
        except Exception as exc:  # pragma: no cover - depends on live Redis
            logger.warning("cache_set_failed", error=str(exc))

    def delete_prefix(self, prefix: str) -> None:
        try:
            for key in self._client.scan_iter(match=f"{prefix}*"):
                self._client.delete(key)
        except Exception as exc:  # pragma: no cover - depends on live Redis
            logger.warning("cache_delete_failed", error=str(exc))


def _build_cache():
    if settings.REDIS_URL:
        try:
            import redis

            client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)
            logger.info("cache_backend_selected", backend="redis")
            return _RedisCache(client)
        except Exception as exc:  # pragma: no cover - depends on environment
            logger.warning("redis_unavailable_using_memory", error=str(exc))
    logger.info("cache_backend_selected", backend="in_process")
    return _InProcessCache()


cache = _build_cache()
