"""In-process idempotency store for unsafe (POST) requests.

Clients opt in by sending an ``Idempotency-Key`` header. The first response for
a given key is cached and replayed on retries, so a client that retries after a
dropped connection never creates a duplicate resource.

The store is per-process and in-memory — the same trade-off the rate limiter
currently makes (see Phase 5, "move rate limiting to a Redis-backed store").
A Redis-backed store will replace this when the app runs multiple workers.
"""

import threading
import time
from dataclasses import dataclass

# Keys live for 24h — long enough to cover any sane client retry window.
DEFAULT_TTL_SECONDS = 24 * 60 * 60


@dataclass
class StoredResponse:
    status_code: int
    body: bytes
    media_type: str
    request_fingerprint: str
    expires_at: float


class IdempotencyStore:
    def __init__(self, ttl_seconds: int = DEFAULT_TTL_SECONDS):
        self._ttl = ttl_seconds
        self._lock = threading.Lock()
        self._entries: dict[str, StoredResponse] = {}

    def _purge_expired(self, now: float) -> None:
        expired = [k for k, v in self._entries.items() if v.expires_at <= now]
        for k in expired:
            del self._entries[k]

    def get(self, key: str) -> StoredResponse | None:
        now = time.monotonic()
        with self._lock:
            self._purge_expired(now)
            return self._entries.get(key)

    def put(
        self,
        key: str,
        status_code: int,
        body: bytes,
        media_type: str,
        request_fingerprint: str,
    ) -> None:
        now = time.monotonic()
        with self._lock:
            self._entries[key] = StoredResponse(
                status_code=status_code,
                body=body,
                media_type=media_type,
                request_fingerprint=request_fingerprint,
                expires_at=now + self._ttl,
            )

    def clear(self) -> None:
        with self._lock:
            self._entries.clear()


store = IdempotencyStore()
