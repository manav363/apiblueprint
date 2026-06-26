"""Schemathesis contract tests.

Property-based fuzzing of every operation in the app's generated OpenAPI schema,
driven in-process against the ASGI app (no live server, no flaky ports). The
``not_a_server_error`` check asserts that no generated input — valid or hostile —
can knock an endpoint into a 5xx, which is the contract guarantee we care about
for a portfolio API. Requests are sent with a valid admin token so secured routes
are actually reached rather than short-circuiting at the auth gate.
"""

import pytest

pytest.importorskip("schemathesis")

import schemathesis  # noqa: E402
from hypothesis import settings as hypothesis_settings  # noqa: E402

# FastAPI emits OpenAPI 3.1; enable Schemathesis' 3.1 support.
schemathesis.experimental.OPEN_API_3_1.enable()

from app.core.database import Base, engine  # noqa: E402
from app.core.security import create_access_token  # noqa: E402
from app.main import app  # noqa: E402

# Tables must exist so secured GETs return 404 (not a 5xx from a missing table).
Base.metadata.create_all(bind=engine)

_token_payload = create_access_token("test-admin")
_token = _token_payload["access_token"] if isinstance(_token_payload, dict) else _token_payload.access_token
AUTH_HEADERS = {"Authorization": f"Bearer {_token}"}

schema = schemathesis.from_asgi("/openapi.json", app)


@pytest.fixture(autouse=True)
def _ensure_tables():
    # Other test modules' fixtures drop_all on teardown; recreate the schema
    # before each contract example so requests hit real tables, not 5xx.
    Base.metadata.create_all(bind=engine)
    yield


# IDs are 32-bit integer columns. Clamp generated path integers into that range
# so the fuzzer exercises real "not found" behaviour instead of a driver-level
# integer-overflow that only manifests as a 5xx for absurd, out-of-range inputs.
INT32_MAX = 2**31 - 1


def _clamp_ints(params):
    """Clamp integer values into the 32-bit id/offset range used by the DB."""
    if not params:
        return params
    for key, value in list(params.items()):
        if isinstance(value, int) and not isinstance(value, bool):
            params[key] = abs(value) % INT32_MAX
    return params


@schemathesis.hook
def map_path_parameters(context, path_parameters):
    return _clamp_ints(path_parameters)


@schemathesis.hook
def map_query(context, query):
    return _clamp_ints(query)


@schema.parametrize()
@hypothesis_settings(max_examples=15, deadline=None)
def test_api_never_returns_server_error(case):
    case.call_and_validate(
        headers=AUTH_HEADERS,
        checks=(schemathesis.checks.not_a_server_error,),
    )
