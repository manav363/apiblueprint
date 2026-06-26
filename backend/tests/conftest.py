"""Shared pytest fixtures.

Environment variables are set here (before the app is imported anywhere) so the
application boots against an isolated SQLite database with deterministic auth
credentials. Each test gets a clean schema via the ``client`` fixture.
"""

import os
import sys
import tempfile
from pathlib import Path

import pytest

TEST_DB_PATH = Path(tempfile.gettempdir()) / "apiblueprint_pytest.sqlite3"

os.environ.setdefault("DATABASE_URL", f"sqlite:///{TEST_DB_PATH}")
os.environ.setdefault("CORS_ORIGINS", '["http://localhost:5173"]')
os.environ.setdefault("ADMIN_USERNAME", "test-admin")
os.environ.setdefault("ADMIN_PASSWORD", "test-password")
os.environ.setdefault("JWT_SECRET", "test-jwt-secret-with-enough-entropy")
os.environ.setdefault("JWT_EXPIRES_MINUTES", "60")
# Disable the in-process rate limiter under test: the whole suite shares one app
# instance, so accumulated logins would otherwise trip the per-minute login cap.
os.environ.setdefault("RATE_LIMIT_ENABLED", "False")
# Expose /openapi.json so the Schemathesis contract test can load the schema.
os.environ.setdefault("ENABLE_API_DOCS", "True")

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from fastapi.testclient import TestClient  # noqa: E402

from app.core.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture
def client():
    """A TestClient backed by a freshly migrated, isolated database per test.

    The client is created without the ``with`` context manager on purpose: the
    app's lifespan registers a SIGTERM handler, which raises off the main
    thread under the test portal. Skipping lifespan keeps tests thread-safe and
    is fine here because the database schema is managed explicitly below.
    """
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    test_client = TestClient(app)
    yield test_client
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def auth_headers(client):
    """Authorization header for the seeded admin user."""
    response = client.post(
        "/api/auth/login",
        json={"username": "test-admin", "password": "test-password"},
    )
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
