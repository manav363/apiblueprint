"""Add performance indexes on foreign keys and ordering columns

Speeds up the hot read paths: list_projects (ORDER BY created_at), list_endpoints
and the spec-generation graph walk (filters/joins on the *_id foreign keys).

Revision ID: 20260625_000002
Revises: 20260427_000001
Create Date: 2026-06-25 00:00:00
"""

from alembic import op

revision = "20260625_000002"
down_revision = "20260427_000001"
branch_labels = None
depends_on = None


# (index_name, table, column)
_INDEXES = [
    ("ix_projects_created_at", "projects", "created_at"),
    ("ix_endpoints_project_id", "endpoints", "project_id"),
    ("ix_parameters_endpoint_id", "parameters", "endpoint_id"),
    ("ix_responses_endpoint_id", "responses", "endpoint_id"),
    ("ix_schemas_project_id", "schemas", "project_id"),
    ("ix_schema_fields_schema_id", "schema_fields", "schema_id"),
    ("ix_schema_fields_parent_id", "schema_fields", "parent_id"),
]


def upgrade() -> None:
    for name, table, column in _INDEXES:
        op.create_index(name, table, [column], unique=False)


def downgrade() -> None:
    for name, table, _column in reversed(_INDEXES):
        op.drop_index(name, table_name=table)
