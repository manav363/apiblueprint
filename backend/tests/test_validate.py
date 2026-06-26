"""Tests for the standalone OpenAPI spec validator (POST /api/validate)."""

import json

import yaml

VALID_SPEC = {
    "openapi": "3.0.3",
    "info": {"title": "Petstore", "version": "1.0.0"},
    "paths": {
        "/pets": {
            "get": {
                "responses": {"200": {"description": "A list of pets"}},
            }
        }
    },
}


def test_valid_spec_has_no_errors(client):
    response = client.post("/api/validate", json=VALID_SPEC)
    assert response.status_code == 200
    body = response.json()
    assert body["valid"] is True
    assert body["errors"] == []


def test_missing_required_field_reports_error(client):
    bad = {"openapi": "3.0.3", "info": {"title": "No version"}, "paths": {}}
    response = client.post("/api/validate", json=bad)
    body = response.json()
    assert body["valid"] is False
    assert len(body["errors"]) >= 1
    messages = " ".join(e["message"] for e in body["errors"])
    assert "version" in messages
    # Errors carry a JSON path pointing at the offending node.
    assert any(e["path"].startswith("$") for e in body["errors"])


def test_yaml_body_is_accepted(client):
    yaml_body = yaml.dump(VALID_SPEC)
    response = client.post(
        "/api/validate",
        content=yaml_body,
        headers={"Content-Type": "text/yaml"},
    )
    assert response.status_code == 200
    assert response.json()["valid"] is True


def test_unparseable_body_returns_error_not_500(client):
    response = client.post(
        "/api/validate",
        content="{not: valid: yaml: ::::",
        headers={"Content-Type": "text/plain"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["valid"] is False
    assert body["errors"]


def test_empty_body_returns_error(client):
    response = client.post(
        "/api/validate",
        content="",
        headers={"Content-Type": "text/plain"},
    )
    assert response.status_code == 200
    assert response.json()["valid"] is False


def test_non_object_body_returns_error(client):
    response = client.post(
        "/api/validate",
        content=json.dumps([1, 2, 3]),
        headers={"Content-Type": "application/json"},
    )
    body = response.json()
    assert body["valid"] is False
    assert "object" in body["errors"][0]["message"].lower()


def test_validate_is_public(client):
    # No Authorization header — the linter must not require auth.
    response = client.post("/api/validate", json=VALID_SPEC)
    assert response.status_code == 200
