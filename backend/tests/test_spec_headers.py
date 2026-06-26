"""Tests for CDN-oriented spec caching: ETag/304 and immutable hashed URLs."""

IMMUTABLE_MAX_AGE = "31536000"


def _make_project(client, auth_headers):
    project = client.post(
        "/api/v1/projects",
        json={"name": "Cacheable", "version": "1.0.0"},
        headers=auth_headers,
    ).json()
    return project["id"]


def test_spec_json_sets_etag_and_cache_headers(client, auth_headers):
    pid = _make_project(client, auth_headers)
    res = client.get(f"/api/v1/projects/{pid}/spec.json", headers=auth_headers)
    assert res.status_code == 200
    assert res.headers["ETag"].startswith('"')
    assert "max-age" in res.headers["Cache-Control"]
    # Content-Location points at the immutable, content-addressed copy.
    assert "/spec/" in res.headers["Content-Location"]
    assert res.headers["Content-Location"].endswith(".json")


def test_matching_if_none_match_returns_304(client, auth_headers):
    pid = _make_project(client, auth_headers)
    first = client.get(f"/api/v1/projects/{pid}/spec.json", headers=auth_headers)
    etag = first.headers["ETag"]

    second = client.get(
        f"/api/v1/projects/{pid}/spec.json",
        headers={**auth_headers, "If-None-Match": etag},
    )
    assert second.status_code == 304
    assert second.headers["ETag"] == etag


def test_etag_changes_after_mutation(client, auth_headers):
    pid = _make_project(client, auth_headers)
    before = client.get(f"/api/v1/projects/{pid}/spec.json", headers=auth_headers).headers["ETag"]

    client.post(
        f"/api/v1/projects/{pid}/endpoints",
        json={"method": "GET", "path": "/things"},
        headers=auth_headers,
    )
    after = client.get(f"/api/v1/projects/{pid}/spec.json", headers=auth_headers).headers["ETag"]
    assert before != after


def test_immutable_hashed_url_is_cacheable_and_fetchable(client, auth_headers):
    pid = _make_project(client, auth_headers)
    res = client.get(f"/api/v1/projects/{pid}/spec.json", headers=auth_headers)
    hashed_url = res.headers["Content-Location"]

    hashed = client.get(hashed_url, headers=auth_headers)
    assert hashed.status_code == 200
    assert hashed.json() == res.json()
    cache_control = hashed.headers["Cache-Control"]
    assert IMMUTABLE_MAX_AGE in cache_control
    assert "immutable" in cache_control


def test_immutable_url_with_stale_hash_returns_404(client, auth_headers):
    pid = _make_project(client, auth_headers)
    res = client.get(
        f"/api/v1/projects/{pid}/spec/deadbeefdeadbeef.json",
        headers=auth_headers,
    )
    assert res.status_code == 404


def test_yaml_spec_also_supports_conditional_get(client, auth_headers):
    pid = _make_project(client, auth_headers)
    first = client.get(f"/api/v1/projects/{pid}/spec", headers=auth_headers)
    assert first.status_code == 200
    etag = first.headers["ETag"]
    second = client.get(
        f"/api/v1/projects/{pid}/spec",
        headers={**auth_headers, "If-None-Match": etag},
    )
    assert second.status_code == 304
