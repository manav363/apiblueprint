"""Integration tests for the core API surface.

Covers the happy path, 404s, and auth failures across the project/endpoint/schema
routes so the secured CRUD flows are exercised end to end against a real (SQLite)
database. The legacy unittest smoke suite stays in place; these add focused
pytest-style coverage of error branches.
"""

import pytest


# ── Auth gating ────────────────────────────────────────────
@pytest.mark.parametrize(
    "method,path",
    [
        ("get", "/api/v1/projects"),
        ("post", "/api/v1/projects"),
        ("get", "/api/v1/projects/1"),
        ("get", "/api/v1/projects/1/endpoints"),
        ("get", "/api/v1/projects/1/schemas"),
    ],
)
def test_secured_routes_reject_anonymous(client, method, path):
    response = getattr(client, method)(path)
    assert response.status_code == 401


def test_secured_route_rejects_bad_token(client):
    response = client.get(
        "/api/v1/projects",
        headers={"Authorization": "Bearer not-a-real-token"},
    )
    assert response.status_code == 401


def test_login_with_wrong_password_is_rejected(client):
    response = client.post(
        "/api/auth/login",
        json={"username": "test-admin", "password": "wrong"},
    )
    assert response.status_code == 401


def test_login_with_non_ascii_credentials_is_rejected_not_500(client):
    # Regression: secrets.compare_digest raises TypeError on non-ASCII strings,
    # which previously turned a hostile login into a 500. It must be a clean 401.
    response = client.post(
        "/api/auth/login",
        json={"username": "admín", "password": "pásswörd"},
    )
    assert response.status_code == 401


# ── Happy path ─────────────────────────────────────────────
def test_project_crud_round_trip(client, auth_headers):
    created = client.post(
        "/api/v1/projects",
        json={"name": "Billing API", "version": "v2.0.0", "description": "x", "color": "#fff"},
        headers=auth_headers,
    )
    assert created.status_code == 201
    project_id = created.json()["id"]

    fetched = client.get(f"/api/v1/projects/{project_id}", headers=auth_headers)
    assert fetched.status_code == 200
    assert fetched.json()["name"] == "Billing API"

    updated = client.put(
        f"/api/v1/projects/{project_id}",
        json={"name": "Billing API v2"},
        headers=auth_headers,
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Billing API v2"

    listed = client.get("/api/v1/projects", headers=auth_headers)
    assert listed.status_code == 200
    assert any(p["id"] == project_id for p in listed.json())

    deleted = client.delete(f"/api/v1/projects/{project_id}", headers=auth_headers)
    assert deleted.status_code == 204

    gone = client.get(f"/api/v1/projects/{project_id}", headers=auth_headers)
    assert gone.status_code == 404


# ── 404s ───────────────────────────────────────────────────
@pytest.mark.parametrize(
    "method,path",
    [
        ("get", "/api/v1/projects/999999"),
        ("put", "/api/v1/projects/999999"),
        ("delete", "/api/v1/projects/999999"),
        ("get", "/api/v1/endpoints/999999"),
        ("get", "/api/v1/projects/999999/spec.json"),
    ],
)
def test_missing_resources_return_404(client, auth_headers, method, path):
    kwargs = {"headers": auth_headers}
    if method in {"put", "post"}:
        kwargs["json"] = {}
    response = getattr(client, method)(path, **kwargs)
    assert response.status_code == 404


def test_404_error_shape_includes_trace_id(client, auth_headers):
    response = client.get("/api/v1/projects/999999", headers=auth_headers)
    assert response.status_code == 404
    body = response.json()
    # Error envelope: {error: {code, message, trace_id}}
    assert "error" in body
    assert body["error"]["trace_id"] == response.headers.get("X-Request-ID")
