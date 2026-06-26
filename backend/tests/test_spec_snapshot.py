"""Snapshot test for OpenAPI generation.

Builds a fixed project (endpoint with a parameter + response, plus a schema with
a nested field) and asserts the generated spec matches a stored snapshot. The
generated spec is also fed back through the standalone validator so the snapshot
can never drift into something structurally invalid.

Regenerate the snapshot intentionally with: ``UPDATE_SNAPSHOTS=1 pytest``.
"""

import json
import os
from pathlib import Path

SNAPSHOT_DIR = Path(__file__).parent / "snapshots"
SNAPSHOT_PATH = SNAPSHOT_DIR / "petstore_spec.json"


def _build_known_project(client, auth_headers) -> int:
    project = client.post(
        "/api/v1/projects",
        json={
            "name": "Petstore",
            "version": "1.0.0",
            "description": "A fixed project for snapshot testing",
            "color": "#00d4aa",
        },
        headers=auth_headers,
    ).json()
    project_id = project["id"]

    endpoint = client.post(
        f"/api/v1/projects/{project_id}/endpoints",
        json={
            "method": "GET",
            "path": "/pets/{petId}",
            "group_name": "Pets",
            "summary": "Get a pet",
            "operation_id": "getPet",
            "tag": "pets",
            "description": "Return a single pet by id",
        },
        headers=auth_headers,
    ).json()
    endpoint_id = endpoint["id"]

    client.post(
        f"/api/v1/endpoints/{endpoint_id}/parameters",
        json={
            "name": "petId",
            "location": "path",
            "type": "integer",
            "required": True,
            "description": "ID of the pet",
        },
        headers=auth_headers,
    )
    client.post(
        f"/api/v1/endpoints/{endpoint_id}/responses",
        json={
            "status_code": "200",
            "description": "The pet",
            "example": json.dumps({"id": 1, "name": "Rex"}),
        },
        headers=auth_headers,
    )

    schema = client.post(
        f"/api/v1/projects/{project_id}/schemas",
        json={"name": "Pet"},
        headers=auth_headers,
    ).json()
    schema_id = schema["id"]
    client.post(
        f"/api/v1/schemas/{schema_id}/fields",
        json={"name": "id", "type": "integer", "required": True},
        headers=auth_headers,
    )
    client.post(
        f"/api/v1/schemas/{schema_id}/fields",
        json={"name": "name", "type": "string", "required": True},
        headers=auth_headers,
    )
    return project_id


def test_generated_spec_matches_snapshot(client, auth_headers):
    project_id = _build_known_project(client, auth_headers)
    response = client.get(f"/api/v1/projects/{project_id}/spec.json", headers=auth_headers)
    assert response.status_code == 200
    generated = response.json()

    if os.environ.get("UPDATE_SNAPSHOTS"):
        SNAPSHOT_DIR.mkdir(exist_ok=True)
        SNAPSHOT_PATH.write_text(json.dumps(generated, indent=2, sort_keys=True) + "\n")

    assert SNAPSHOT_PATH.exists(), "Snapshot missing — run UPDATE_SNAPSHOTS=1 pytest to create it"
    stored = json.loads(SNAPSHOT_PATH.read_text())
    assert generated == stored


def test_generated_spec_is_valid_openapi(client, auth_headers):
    project_id = _build_known_project(client, auth_headers)
    spec = client.get(f"/api/v1/projects/{project_id}/spec.json", headers=auth_headers).json()
    result = client.post("/api/validate", json=spec).json()
    assert result["valid"] is True, result["errors"]
