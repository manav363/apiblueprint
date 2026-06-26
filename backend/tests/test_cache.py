"""Tests for the cache layer and content-addressed spec caching."""

import time

from app.core.cache import _InProcessCache, cache


def test_in_process_cache_set_get_and_miss():
    c = _InProcessCache()
    assert c.get("missing") is None
    c.set("k", {"a": 1})
    assert c.get("k") == {"a": 1}


def test_in_process_cache_ttl_expiry(monkeypatch):
    c = _InProcessCache()
    c.set("k", "v", ttl_seconds=1)
    assert c.get("k") == "v"
    # Advance the monotonic clock past the TTL without sleeping.
    real = time.monotonic()
    monkeypatch.setattr("app.core.cache.time.monotonic", lambda: real + 2)
    assert c.get("k") is None


def test_in_process_cache_delete_prefix():
    c = _InProcessCache()
    c.set("spec:1:abc", 1)
    c.set("spec:1:def", 2)
    c.set("spec:2:ghi", 3)
    c.delete_prefix("spec:1:")
    assert c.get("spec:1:abc") is None
    assert c.get("spec:1:def") is None
    assert c.get("spec:2:ghi") == 3


def test_spec_cache_serves_repeated_requests_consistently(client, auth_headers):
    project = client.post(
        "/api/v1/projects",
        json={"name": "Cached", "version": "1.0.0"},
        headers=auth_headers,
    ).json()
    pid = project["id"]

    first = client.get(f"/api/v1/projects/{pid}/spec.json", headers=auth_headers).json()
    second = client.get(f"/api/v1/projects/{pid}/spec.json", headers=auth_headers).json()
    assert first == second


def test_spec_cache_invalidated_on_mutation(client, auth_headers):
    # Reset shared in-process cache so this test is isolated.
    if hasattr(cache, "clear"):
        cache.clear()

    project = client.post(
        "/api/v1/projects",
        json={"name": "Evolving", "version": "1.0.0"},
        headers=auth_headers,
    ).json()
    pid = project["id"]

    before = client.get(f"/api/v1/projects/{pid}/spec.json", headers=auth_headers).json()
    assert before["paths"] == {}

    # Mutate the graph — the content hash changes, so the cache key changes.
    client.post(
        f"/api/v1/projects/{pid}/endpoints",
        json={"method": "GET", "path": "/widgets", "summary": "List widgets"},
        headers=auth_headers,
    )

    after = client.get(f"/api/v1/projects/{pid}/spec.json", headers=auth_headers).json()
    assert "/widgets" in after["paths"], "spec cache served stale data after a mutation"
