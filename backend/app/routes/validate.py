"""Standalone OpenAPI spec validator.

``POST /api/validate`` accepts an OpenAPI 3.0/3.1 document as the raw request
body (JSON or YAML — JSON is a subset of YAML, so a single YAML parse handles
both) and returns every structural error it finds rather than failing on the
first one. It is stateless and does not touch the database, so it stays outside
the authenticated ``/api/v1`` routers and acts as a lint utility.
"""

import yaml
from fastapi import APIRouter, Request
from openapi_spec_validator import OpenAPIV30SpecValidator, OpenAPIV31SpecValidator

from ..models.schemas import ValidationIssue, ValidationResult

router = APIRouter(prefix="/api", tags=["Validation"])

# Cap how many individual errors we echo back so a wildly malformed document
# can't produce an unbounded response.
MAX_ERRORS = 100


def _select_validator(spec: dict):
    """Pick the 3.1 or 3.0 validator from the document's ``openapi`` version."""
    version = str(spec.get("openapi", ""))
    if version.startswith("3.1"):
        return OpenAPIV31SpecValidator(spec)
    return OpenAPIV30SpecValidator(spec)


def collect_errors(spec: dict) -> list[ValidationIssue]:
    """Return structural OpenAPI errors as ``{path, message}`` issues."""
    issues: list[ValidationIssue] = []
    for error in _select_validator(spec).iter_errors():
        path = getattr(error, "json_path", None) or "$"
        issues.append(ValidationIssue(path=path, message=error.message))
        if len(issues) >= MAX_ERRORS:
            break
    return issues


@router.post(
    "/validate",
    response_model=ValidationResult,
    summary="Validate an OpenAPI document",
    description=(
        "Validate a raw OpenAPI 3.0/3.1 document supplied as the request body "
        "(JSON or YAML). Returns `valid` plus a list of `{path, message}` errors."
    ),
    responses={200: {"description": "Validation result (valid or with errors)"}},
)
async def validate_spec(request: Request) -> ValidationResult:
    raw = await request.body()
    if not raw or not raw.strip():
        return ValidationResult(
            valid=False,
            errors=[ValidationIssue(path="$", message="Request body is empty")],
        )

    try:
        spec = yaml.safe_load(raw)
    except yaml.YAMLError as exc:
        return ValidationResult(
            valid=False,
            errors=[ValidationIssue(path="$", message=f"Could not parse document: {exc}")],
        )

    if not isinstance(spec, dict):
        return ValidationResult(
            valid=False,
            errors=[ValidationIssue(path="$", message="Document must be a JSON/YAML object")],
        )

    errors = collect_errors(spec)
    return ValidationResult(valid=len(errors) == 0, errors=errors)
