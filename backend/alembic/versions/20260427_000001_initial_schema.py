"""Initial schema

Revision ID: 20260427_000001
Revises:
Create Date: 2026-04-27 22:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260427_000001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "projects",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("version", sa.String(length=20), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("color", sa.String(length=20), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=True),
    )
    op.create_index(op.f("ix_projects_id"), "projects", ["id"], unique=False)

    op.create_table(
        "endpoints",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("method", sa.String(length=10), nullable=False),
        sa.Column("path", sa.String(length=200), nullable=False),
        sa.Column("group_name", sa.String(length=100), nullable=True),
        sa.Column("summary", sa.String(length=200), nullable=True),
        sa.Column("operation_id", sa.String(length=100), nullable=True),
        sa.Column("tag", sa.String(length=100), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=True),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
    )
    op.create_index(op.f("ix_endpoints_id"), "endpoints", ["id"], unique=False)

    op.create_table(
        "schemas",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=True),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
    )
    op.create_index(op.f("ix_schemas_id"), "schemas", ["id"], unique=False)

    op.create_table(
        "parameters",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("endpoint_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("location", sa.String(length=20), nullable=False),
        sa.Column("type", sa.String(length=50), nullable=True),
        sa.Column("required", sa.Boolean(), nullable=True),
        sa.Column("description", sa.String(length=300), nullable=True),
        sa.ForeignKeyConstraint(["endpoint_id"], ["endpoints.id"]),
    )
    op.create_index(op.f("ix_parameters_id"), "parameters", ["id"], unique=False)

    op.create_table(
        "responses",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("endpoint_id", sa.Integer(), nullable=False),
        sa.Column("status_code", sa.String(length=10), nullable=False),
        sa.Column("description", sa.String(length=300), nullable=True),
        sa.Column("example", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["endpoint_id"], ["endpoints.id"]),
    )
    op.create_index(op.f("ix_responses_id"), "responses", ["id"], unique=False)

    op.create_table(
        "schema_fields",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("schema_id", sa.Integer(), nullable=False),
        sa.Column("parent_id", sa.Integer(), nullable=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("type", sa.String(length=50), nullable=True),
        sa.Column("required", sa.Boolean(), nullable=True),
        sa.Column("description", sa.String(length=300), nullable=True),
        sa.ForeignKeyConstraint(["parent_id"], ["schema_fields.id"]),
        sa.ForeignKeyConstraint(["schema_id"], ["schemas.id"]),
    )
    op.create_index(op.f("ix_schema_fields_id"), "schema_fields", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_schema_fields_id"), table_name="schema_fields")
    op.drop_table("schema_fields")
    op.drop_index(op.f("ix_responses_id"), table_name="responses")
    op.drop_table("responses")
    op.drop_index(op.f("ix_parameters_id"), table_name="parameters")
    op.drop_table("parameters")
    op.drop_index(op.f("ix_schemas_id"), table_name="schemas")
    op.drop_table("schemas")
    op.drop_index(op.f("ix_endpoints_id"), table_name="endpoints")
    op.drop_table("endpoints")
    op.drop_index(op.f("ix_projects_id"), table_name="projects")
    op.drop_table("projects")
