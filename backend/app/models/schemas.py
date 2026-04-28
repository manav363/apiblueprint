import json
from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime


def validate_json_example(value: Optional[str]) -> Optional[str]:
    if value is None:
        return value

    try:
        json.loads(value)
    except json.JSONDecodeError as exc:
        raise ValueError(
            f"Response example must be valid JSON: {exc.msg} at line {exc.lineno}, column {exc.colno}"
        ) from exc

    return value


# ── Parameter ──────────────────────────────────────────────
class ParameterBase(BaseModel):
    name: str
    location: str
    type: str = "string"
    required: bool = False
    description: str = ""

class ParameterCreate(ParameterBase): pass

class ParameterUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    type: Optional[str] = None
    required: Optional[bool] = None
    description: Optional[str] = None

class ParameterOut(ParameterBase):
    id: int
    endpoint_id: int
    class Config: from_attributes = True


# ── Response ───────────────────────────────────────────────
class ResponseBase(BaseModel):
    status_code: str
    description: str = ""
    example: str = "{}"

    @field_validator("example")
    @classmethod
    def validate_example(cls, value: str) -> str:
        return validate_json_example(value)

class ResponseCreate(ResponseBase): pass

class ResponseUpdate(BaseModel):
    description: Optional[str] = None
    example: Optional[str] = None

    @field_validator("example")
    @classmethod
    def validate_example(cls, value: Optional[str]) -> Optional[str]:
        return validate_json_example(value)

class ResponseOut(ResponseBase):
    id: int
    endpoint_id: int
    class Config: from_attributes = True


# ── Endpoint ───────────────────────────────────────────────
class EndpointBase(BaseModel):
    method: str
    path: str
    group_name: str = "Default"
    summary: str = ""
    operation_id: str = ""
    tag: str = ""
    description: str = ""

class EndpointCreate(EndpointBase): pass

class EndpointUpdate(BaseModel):
    method: Optional[str] = None
    path: Optional[str] = None
    group_name: Optional[str] = None
    summary: Optional[str] = None
    operation_id: Optional[str] = None
    tag: Optional[str] = None
    description: Optional[str] = None

class EndpointOut(EndpointBase):
    id: int
    project_id: int
    parameters: list[ParameterOut] = []
    responses: list[ResponseOut] = []
    class Config: from_attributes = True


# ── SchemaField ────────────────────────────────────────────
class SchemaFieldBase(BaseModel):
    name: str
    type: str = "string"
    required: bool = False
    description: str = ""
    parent_id: Optional[int] = None

class SchemaFieldCreate(SchemaFieldBase): pass

class SchemaFieldOut(SchemaFieldBase):
    id: int
    schema_id: int
    class Config: from_attributes = True


# ── Schema ─────────────────────────────────────────────────
class SchemaBase(BaseModel):
    name: str

class SchemaCreate(SchemaBase): pass

class SchemaOut(SchemaBase):
    id: int
    project_id: int
    fields: list[SchemaFieldOut] = []
    class Config: from_attributes = True


# ── Project ────────────────────────────────────────────────
class ProjectBase(BaseModel):
    name: str
    version: str = "v1.0.0"
    description: str = ""
    color: str = "#00d4aa"

class ProjectCreate(ProjectBase): pass

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    version: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None

class ProjectOut(ProjectBase):
    id: int
    created_at: datetime
    updated_at: datetime
    endpoints: list[EndpointOut] = []
    schemas: list[SchemaOut] = []
    class Config: from_attributes = True

class ProjectSummary(ProjectBase):
    id: int
    created_at: datetime
    updated_at: datetime
    endpoint_count: int = 0
    class Config: from_attributes = True
