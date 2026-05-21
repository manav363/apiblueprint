import json
from copy import deepcopy

import yaml
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..models.models import Project

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


@router.get("/api/projects/{project_id}/spec")
def get_spec_yaml(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    spec = generate_spec(project)
    yaml_str = yaml.dump(spec, allow_unicode=True, sort_keys=False, default_flow_style=False)
    return Response(content=yaml_str, media_type="text/yaml")


@router.get("/api/projects/{project_id}/spec.json")
def get_spec_json(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    spec = generate_spec(project)
    return spec
