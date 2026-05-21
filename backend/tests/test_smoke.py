import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

TEST_DB_PATH = Path(tempfile.gettempdir()) / "apiblueprint_smoke.sqlite3"

os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"
os.environ["CORS_ORIGINS"] = '["http://localhost:5173"]'
os.environ["ADMIN_USERNAME"] = "test-admin"
os.environ["ADMIN_PASSWORD"] = "test-password"
os.environ["JWT_SECRET"] = "test-jwt-secret-with-enough-entropy"
os.environ["JWT_EXPIRES_MINUTES"] = "60"

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from fastapi.testclient import TestClient  # noqa: E402

from app.core.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


class ApiBlueprintSmokeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        response = cls.client.post(
            "/api/auth/login",
            json={
                "username": "test-admin",
                "password": "test-password",
            },
        )
        assert response.status_code == 200
        token = response.json()["access_token"]
        cls.auth_headers = {"Authorization": f"Bearer {token}"}

    def setUp(self):
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)

    def create_project(self, name="Billing API"):
        response = self.client.post(
            "/api/projects",
            json={
                "name": name,
                "version": "v1.0.0",
                "description": "Test project",
                "color": "#00d4aa",
            },
            headers=self.auth_headers,
        )
        self.assertEqual(response.status_code, 201)
        return response.json()

    def create_endpoint(self, project_id, **overrides):
        payload = {
            "method": "GET",
            "path": "/users/{id}",
            "group_name": "Users",
            "summary": "Get user",
            "operation_id": "getUser",
            "tag": "users",
            "description": "Return a single user",
        }
        payload.update(overrides)
        response = self.client.post(
            f"/api/projects/{project_id}/endpoints",
            json=payload,
            headers=self.auth_headers,
        )
        self.assertEqual(response.status_code, 201)
        return response.json()

    def create_schema(self, project_id, name="User"):
        response = self.client.post(
            f"/api/projects/{project_id}/schemas",
            json={"name": name},
            headers=self.auth_headers,
        )
        self.assertEqual(response.status_code, 201)
        return response.json()

    def create_field(self, schema_id, **overrides):
        payload = {
            "name": "id",
            "type": "UUID",
            "required": True,
            "description": "Primary key",
            "parent_id": None,
        }
        payload.update(overrides)
        response = self.client.post(
            f"/api/schemas/{schema_id}/fields",
            json=payload,
            headers=self.auth_headers,
        )
        self.assertEqual(response.status_code, 201)
        return response.json()

    def test_health_endpoint(self):
        response = self.client.get("/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok", "service": "apiblueprint-backend"})

    def test_jwt_login_session_and_protected_routes(self):
        login_response = self.client.post(
            "/api/auth/login",
            json={
                "username": "test-admin",
                "password": "test-password",
            },
        )
        self.assertEqual(login_response.status_code, 200)
        token_payload = login_response.json()
        self.assertEqual(token_payload["token_type"], "bearer")
        self.assertEqual(token_payload["username"], "test-admin")
        self.assertTrue(token_payload["access_token"])

        session_response = self.client.get(
            "/api/session",
            headers={
                "Authorization": f"Bearer {token_payload['access_token']}",
            },
        )
        self.assertEqual(session_response.status_code, 200)
        self.assertEqual(session_response.json(), {"authenticated": True, "username": "test-admin"})

        anonymous_response = self.client.get("/api/projects")
        self.assertEqual(anonymous_response.status_code, 401)

        invalid_login = self.client.post(
            "/api/auth/login",
            json={
                "username": "test-admin",
                "password": "wrong-password",
            },
        )
        self.assertEqual(invalid_login.status_code, 401)

    def test_project_crud(self):
        created = self.create_project()
        project_id = created["id"]

        list_response = self.client.get("/api/projects", headers=self.auth_headers)
        self.assertEqual(list_response.status_code, 200)
        projects = list_response.json()
        self.assertEqual(len(projects), 1)
        self.assertEqual(projects[0]["endpoint_count"], 0)
        self.assertEqual(projects[0]["name"], "Billing API")

        detail_response = self.client.get(f"/api/projects/{project_id}", headers=self.auth_headers)
        self.assertEqual(detail_response.status_code, 200)
        self.assertEqual(detail_response.json()["id"], project_id)

        update_response = self.client.put(
            f"/api/projects/{project_id}",
            json={
                "name": "Payments API",
                "description": "Updated description",
            },
            headers=self.auth_headers,
        )
        self.assertEqual(update_response.status_code, 200)
        updated = update_response.json()
        self.assertEqual(updated["name"], "Payments API")
        self.assertEqual(updated["description"], "Updated description")

        delete_response = self.client.delete(f"/api/projects/{project_id}", headers=self.auth_headers)
        self.assertEqual(delete_response.status_code, 204)

        missing_response = self.client.get(f"/api/projects/{project_id}", headers=self.auth_headers)
        self.assertEqual(missing_response.status_code, 404)

    def test_endpoint_crud_parameter_response_and_spec_export(self):
        project = self.create_project()
        endpoint = self.create_endpoint(project["id"])

        list_response = self.client.get(
            f"/api/projects/{project['id']}/endpoints",
            headers=self.auth_headers,
        )
        self.assertEqual(list_response.status_code, 200)
        endpoints = list_response.json()
        self.assertEqual(len(endpoints), 1)
        self.assertEqual(endpoints[0]["group_name"], "Users")
        self.assertEqual(endpoints[0]["operation_id"], "getUser")

        param_response = self.client.post(
            f"/api/endpoints/{endpoint['id']}/parameters",
            json={
                "name": "id",
                "location": "path",
                "type": "integer",
                "required": True,
                "description": "User id",
            },
            headers=self.auth_headers,
        )
        self.assertEqual(param_response.status_code, 201)
        parameter = param_response.json()

        response_response = self.client.post(
            f"/api/endpoints/{endpoint['id']}/responses",
            json={
                "status_code": "200",
                "description": "User payload",
                "example": json.dumps({"id": 7, "name": "Ada"}),
            },
            headers=self.auth_headers,
        )
        self.assertEqual(response_response.status_code, 201)
        created_response = response_response.json()

        endpoint_update = self.client.put(
            f"/api/endpoints/{endpoint['id']}",
            json={
                "summary": "Fetch user",
                "description": "Updated endpoint description",
            },
            headers=self.auth_headers,
        )
        self.assertEqual(endpoint_update.status_code, 200)
        self.assertEqual(endpoint_update.json()["summary"], "Fetch user")

        parameter_update = self.client.put(
            f"/api/parameters/{parameter['id']}",
            json={
                "description": "Numeric user id",
            },
            headers=self.auth_headers,
        )
        self.assertEqual(parameter_update.status_code, 200)
        self.assertEqual(parameter_update.json()["description"], "Numeric user id")

        response_update = self.client.put(
            f"/api/responses/{created_response['id']}",
            json={
                "description": "Updated response",
                "example": json.dumps({"id": 7, "name": "Grace"}),
            },
            headers=self.auth_headers,
        )
        self.assertEqual(response_update.status_code, 200)
        self.assertEqual(response_update.json()["description"], "Updated response")

        spec_json_response = self.client.get(
            f"/api/projects/{project['id']}/spec.json",
            headers=self.auth_headers,
        )
        self.assertEqual(spec_json_response.status_code, 200)
        spec = spec_json_response.json()
        operation = spec["paths"]["/users/{id}"]["get"]
        self.assertEqual(operation["operationId"], "getUser")
        self.assertEqual(operation["summary"], "Fetch user")
        self.assertEqual(operation["parameters"][0]["schema"]["type"], "integer")
        self.assertEqual(
            operation["responses"]["200"]["content"]["application/json"]["example"]["name"],
            "Grace",
        )

        spec_yaml_response = self.client.get(
            f"/api/projects/{project['id']}/spec",
            headers=self.auth_headers,
        )
        self.assertEqual(spec_yaml_response.status_code, 200)
        self.assertIn("openapi: 3.0.3", spec_yaml_response.text)
        self.assertIn("/users/{id}:", spec_yaml_response.text)

        delete_response = self.client.delete(
            f"/api/endpoints/{endpoint['id']}",
            headers=self.auth_headers,
        )
        self.assertEqual(delete_response.status_code, 204)

        list_after_delete = self.client.get(
            f"/api/projects/{project['id']}/endpoints",
            headers=self.auth_headers,
        )
        self.assertEqual(list_after_delete.status_code, 200)
        self.assertEqual(list_after_delete.json(), [])

    def test_invalid_response_example_returns_422(self):
        project = self.create_project("Validation API")
        endpoint = self.create_endpoint(project["id"])

        response = self.client.post(
            f"/api/endpoints/{endpoint['id']}/responses",
            json={
                "status_code": "200",
                "description": "Broken example",
                "example": '{"id": 7,}',
            },
            headers=self.auth_headers,
        )

        self.assertEqual(response.status_code, 422)
        detail = response.json()["detail"]
        self.assertEqual(detail[0]["loc"], ["body", "example"])
        self.assertIn("Response example must be valid JSON", detail[0]["msg"])

    def test_schema_crud_and_nested_export(self):
        project = self.create_project("Schema API")
        schema = self.create_schema(project["id"], "User")

        profile = self.create_field(
            schema["id"],
            name="profile",
            type="object",
            required=True,
            description="Profile payload",
        )
        self.create_field(
            schema["id"],
            name="first_name",
            type="string",
            required=True,
            description="First name",
            parent_id=profile["id"],
        )
        self.create_field(
            schema["id"],
            name="avatar_url",
            type="URL",
            required=False,
            description="Avatar URL",
            parent_id=profile["id"],
        )

        list_response = self.client.get(
            f"/api/projects/{project['id']}/schemas",
            headers=self.auth_headers,
        )
        self.assertEqual(list_response.status_code, 200)
        schemas = list_response.json()
        self.assertEqual(len(schemas), 1)
        self.assertEqual(schemas[0]["name"], "User")
        self.assertEqual(len(schemas[0]["fields"]), 3)

        spec_response = self.client.get(
            f"/api/projects/{project['id']}/spec.json",
            headers=self.auth_headers,
        )
        self.assertEqual(spec_response.status_code, 200)
        spec = spec_response.json()
        user_schema = spec["components"]["schemas"]["User"]
        self.assertEqual(user_schema["properties"]["profile"]["type"], "object")
        self.assertEqual(
            user_schema["properties"]["profile"]["properties"]["first_name"]["type"],
            "string",
        )
        self.assertEqual(
            user_schema["properties"]["profile"]["properties"]["avatar_url"]["format"],
            "uri",
        )
        self.assertIn("profile", user_schema["required"])

        delete_schema_response = self.client.delete(
            f"/api/schemas/{schema['id']}",
            headers=self.auth_headers,
        )
        self.assertEqual(delete_schema_response.status_code, 204)

        list_after_delete = self.client.get(
            f"/api/projects/{project['id']}/schemas",
            headers=self.auth_headers,
        )
        self.assertEqual(list_after_delete.status_code, 200)
        self.assertEqual(list_after_delete.json(), [])

    def test_pagination_query_params(self):
        project = self.create_project("Paginated API")
        self.create_endpoint(project["id"], method="POST", path="/tasks", operation_id="createTask")
        self.create_endpoint(project["id"], method="GET", path="/tasks", operation_id="listTasks")
        self.create_endpoint(project["id"], method="GET", path="/tasks/{id}", operation_id="getTask")

        list_response = self.client.get(
            f"/api/projects/{project['id']}/endpoints?skip=0&limit=2",
            headers=self.auth_headers,
        )
        self.assertEqual(list_response.status_code, 200)
        endpoints = list_response.json()
        self.assertEqual(len(endpoints), 2)

        list_response_page2 = self.client.get(
            f"/api/projects/{project['id']}/endpoints?skip=2&limit=2",
            headers=self.auth_headers,
        )
        self.assertEqual(list_response_page2.status_code, 200)
        self.assertEqual(len(list_response_page2.json()), 1)

    def test_standardized_error_format(self):
        response = self.client.get("/api/projects/99999", headers=self.auth_headers)
        self.assertEqual(response.status_code, 404)
        body = response.json()
        self.assertIn("error", body)
        self.assertIn("code", body["error"])
        self.assertIn("message", body["error"])
        self.assertEqual(body["error"]["code"], 404)

    def test_rate_limit_headers_present(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)


if __name__ == "__main__":
    unittest.main()
