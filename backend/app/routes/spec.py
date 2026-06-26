import hashlib
import json
from copy import deepcopy

import yaml
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session, selectinload

from ..core.cache import cache
from ..core.config import settings
from ..core.database import get_db
from ..models.models import Endpoint, Project, Schema

router = APIRouter(tags=["Spec"])

TYPE_MAP = {
    "string": {"type": "string"},
    "integer": {"type": "integer"},
    "boolean": {"type": "boolean"},
    "number": {"type": "number"},
    "object": {"type": "object", "properties": {}},
    "array": {"type": "array", "items": {"type": "string"}},
    "UUID": {"type": "string", "format": "uuid"},
    "TIMESTAMP": {"type": "string", "format": "date-time"},
    "URL": {"type": "string", "format": "uri"},
}


def map_field_type(field_type: str | None) -> dict:
    normalized = (field_type or "string").strip()
    if normalized in TYPE_MAP:
        return deepcopy(TYPE_MAP[normalized])

    lower = normalized.lower()
    if lower in TYPE_MAP:
        return deepcopy(TYPE_MAP[lower])

    upper = normalized.upper()
    if upper in TYPE_MAP:
        return deepcopy(TYPE_MAP[upper])

    return {"type": "string"}


def build_field_schema(field, children_by_parent) -> dict:
    schema = map_field_type(field.type)
    children = children_by_parent.get(field.id, [])

    if field.description:
        schema["description"] = field.description

    if children:
        child_properties = {}
        child_required = []
        for child in children:
            child_properties[child.name] = build_field_schema(child, children_by_parent)
            if child.required:
                child_required.append(child.name)

        if schema.get("type") == "array":
            items_schema = {"type": "object", "properties": child_properties}
            if child_required:
                items_schema["required"] = child_required
            schema["items"] = items_schema
        else:
            schema["type"] = "object"
            schema["properties"] = child_properties
            if child_required:
                schema["required"] = child_required

    if schema.get("type") == "object" and "properties" not in schema:
        schema["properties"] = {}

    return schema


def generate_spec(project) -> dict:
    """Walk the project DB records and build a valid OpenAPI 3.0 dict."""
    spec = {
        "openapi": "3.0.3",
        "info": {
            "title": project.name,
            "version": project.version,
            "description": project.description,
        },
        "paths": {},
        "components": {
            "securitySchemes": {
                "bearerAuth": {
                    "type": "http",
                    "scheme": "bearer",
                    "bearerFormat": "JWT",
                }
            },
            "schemas": {},
        },
    }

    for endpoint in project.endpoints:
        path = endpoint.path
        method = endpoint.method.lower()

        if path not in spec["paths"]:
            spec["paths"][path] = {}

        operation = {
            "operationId": endpoint.operation_id or f"{method}_{path.replace('/', '_').strip('_')}",
            "summary": endpoint.summary,
            "description": endpoint.description,
            "tags": [endpoint.tag] if endpoint.tag else [],
            "parameters": [],
            "responses": {},
        }

        # Parameters
        for param in endpoint.parameters:
            p = {
                "name": param.name,
                "in": param.location,
                "required": param.required,
                "description": param.description,
                "schema": map_field_type(param.type),
            }
            operation["parameters"].append(p)

        # Responses
        for resp in endpoint.responses:
            operation["responses"][resp.status_code] = {
                "description": resp.description,
            }
            # Try to include example JSON if valid
            try:
                example_data = json.loads(resp.example)
                if example_data:
                    operation["responses"][resp.status_code]["content"] = {
                        "application/json": {"example": example_data}
                    }
            except Exception:
                pass

        if not operation["responses"]:
            operation["responses"]["200"] = {"description": "Successful operation"}

        spec["paths"][path][method] = operation

    # Add schemas from schema builder
    for schema in project.schemas:
        props = {}
        required_fields = []
        children_by_parent = {}
        for field in schema.fields:
            children_by_parent.setdefault(field.parent_id, []).append(field)

        for field in schema.fields:
            if field.parent_id is None:
                props[field.name] = build_field_schema(field, children_by_parent)
                if field.required:
                    required_fields.append(field.name)

        schema_obj = {"type": "object", "properties": props}
        if required_fields:
            schema_obj["required"] = required_fields
        spec["components"]["schemas"][schema.name] = schema_obj

    return spec


def _load_project_for_spec(project_id: int, db: Session) -> Project:
    """Fetch a project with its full graph eager-loaded.

    ``generate_spec`` walks endpoints → parameters/responses and schemas → fields;
    loading them up front avoids an N+1 query storm during generation.
    """
    project = (
        db.query(Project)
        .filter(Project.id == project_id)
        .options(
            selectinload(Project.endpoints).selectinload(Endpoint.parameters),
            selectinload(Project.endpoints).selectinload(Endpoint.responses),
            selectinload(Project.schemas).selectinload(Schema.fields),
        )
        .first()
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def _project_content_hash(project) -> str:
    """A stable hash of everything that influences the generated spec.

    Used as the cache key suffix so any edit to the project graph yields a new
    key — i.e. the spec cache is invalidated automatically on mutation.
    """
    snapshot = {
        "info": [project.name, project.version, project.description],
        "endpoints": [
            {
                "e": [e.method, e.path, e.summary, e.operation_id, e.tag, e.description],
                "params": sorted([p.name, p.location, p.type, p.required, p.description] for p in e.parameters),
                "responses": sorted([r.status_code, r.description, r.example] for r in e.responses),
            }
            for e in sorted(project.endpoints, key=lambda e: (e.path, e.method))
        ],
        "schemas": [
            {
                "name": s.name,
                "fields": sorted([f.name, f.type, f.required, f.description, f.parent_id] for f in s.fields),
            }
            for s in sorted(project.schemas, key=lambda s: s.name)
        ],
    }
    payload = json.dumps(snapshot, sort_keys=True, default=str)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]


def _generate_spec_cached(project, content_hash: str) -> dict:
    """Return the generated spec, served from cache when the project is unchanged."""
    key = f"spec:{project.id}:{content_hash}"
    cached = cache.get(key)
    if cached is not None:
        return cached
    spec = generate_spec(project)
    cache.set(key, spec, ttl_seconds=settings.SPEC_CACHE_TTL_SECONDS)
    return spec


# A generated spec is identified by its content hash, so the hashed URL is
# immutable and safe to cache at the edge for a year. The unhashed URLs carry an
# ETag and a short max-age so a CDN/browser revalidates cheaply (304 on no change).
IMMUTABLE_MAX_AGE = 31536000  # 1 year
REVALIDATE_CACHE_CONTROL = "public, max-age=60"
IMMUTABLE_CACHE_CONTROL = f"public, max-age={IMMUTABLE_MAX_AGE}, immutable"


def _hashed_spec_path(request: Request, content_hash: str) -> str:
    """Build the content-addressed URL for the current spec, e.g.
    /api/v1/projects/1/spec/<hash>.json."""
    base = request.url.path.rsplit("/", 1)[0]  # drop "spec" or "spec.json"
    return f"{base}/spec/{content_hash}.json"


@router.get(
    "/projects/{project_id}/spec",
    summary="Generate the project's OpenAPI spec (YAML)",
    responses={304: {"description": "Not modified"}, 404: {"description": "Project not found"}},
)
def get_spec_yaml(project_id: int, request: Request, db: Session = Depends(get_db)):
    project = _load_project_for_spec(project_id, db)
    content_hash = _project_content_hash(project)
    etag = f'"{content_hash}"'
    headers = {"ETag": etag, "Cache-Control": REVALIDATE_CACHE_CONTROL}
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers=headers)
    spec = _generate_spec_cached(project, content_hash)
    yaml_str = yaml.dump(spec, allow_unicode=True, sort_keys=False, default_flow_style=False)
    return Response(content=yaml_str, media_type="text/yaml", headers=headers)


@router.get(
    "/projects/{project_id}/spec.json",
    summary="Generate the project's OpenAPI spec (JSON)",
    responses={304: {"description": "Not modified"}, 404: {"description": "Project not found"}},
)
def get_spec_json(project_id: int, request: Request, db: Session = Depends(get_db)):
    project = _load_project_for_spec(project_id, db)
    content_hash = _project_content_hash(project)
    etag = f'"{content_hash}"'
    headers = {
        "ETag": etag,
        "Cache-Control": REVALIDATE_CACHE_CONTROL,
        # Point clients/CDNs at the immutable, content-addressed copy.
        "Content-Location": _hashed_spec_path(request, content_hash),
    }
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers=headers)
    spec = _generate_spec_cached(project, content_hash)
    return JSONResponse(content=spec, headers=headers)


@router.get(
    "/projects/{project_id}/spec/{content_hash}.json",
    summary="Fetch an immutable, content-addressed spec version",
    description=(
        "Returns the project's spec for a specific content hash. Because the URL "
        "is content-addressed it is immutable and cacheable for a year. A hash that "
        "no longer matches the project's current content returns 404."
    ),
    responses={404: {"description": "Project or spec version not found"}},
)
def get_spec_json_immutable(project_id: int, content_hash: str, db: Session = Depends(get_db)):
    project = _load_project_for_spec(project_id, db)
    current_hash = _project_content_hash(project)
    if content_hash != current_hash:
        raise HTTPException(status_code=404, detail="Spec version not found")
    spec = _generate_spec_cached(project, current_hash)
    return JSONResponse(
        content=spec,
        headers={"ETag": f'"{current_hash}"', "Cache-Control": IMMUTABLE_CACHE_CONTROL},
    )
