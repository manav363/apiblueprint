#!/usr/bin/env python3
"""
Seed script — populates the DB with one sample project, endpoints,
parameters, responses, and a schema for local development.

Usage:
    python seed.py                     # uses DATABASE_URL env var
    make seed                          # same, via Makefile
"""
import os
import sys

# Allow running from repo root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://apiblueprint:apiblueprint@localhost:5432/apiblueprint",
)

engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)


def seed():
    from app.models.models import (  # noqa: PLC0415
        Endpoint,
        Parameter,
        Project,
        Response,
        Schema,
        SchemaField,
    )

    db = Session()
    try:
        # Remove previous seed data to keep idempotent
        existing = db.query(Project).filter(Project.name == "Petstore API").first()
        if existing:
            db.delete(existing)
            db.commit()
            print("Removed existing seed project.")

        # ── Project ────────────────────────────────────────────────────────────
        project = Project(
            name="Petstore API",
            version="v1.0.0",
            description="A sample REST API for managing pets and orders.",
            color="#00d4aa",
        )
        db.add(project)
        db.flush()

        # ── Endpoints ──────────────────────────────────────────────────────────
        ep_list = Endpoint(
            project_id=project.id,
            method="GET",
            path="/pets",
            summary="List all pets",
            operation_id="listPets",
            tag="pets",
            description="Returns a paginated list of all pets in the store.",
        )
        ep_create = Endpoint(
            project_id=project.id,
            method="POST",
            path="/pets",
            summary="Create a pet",
            operation_id="createPet",
            tag="pets",
            description="Adds a new pet to the store.",
        )
        ep_get = Endpoint(
            project_id=project.id,
            method="GET",
            path="/pets/{petId}",
            summary="Get a pet by ID",
            operation_id="getPetById",
            tag="pets",
            description="Returns a single pet by its ID.",
        )
        db.add_all([ep_list, ep_create, ep_get])
        db.flush()

        # ── Parameters ─────────────────────────────────────────────────────────
        db.add(Parameter(
            endpoint_id=ep_list.id,
            name="limit",
            location="query",
            type="integer",
            required=False,
            description="Maximum number of pets to return (default 20).",
        ))
        db.add(Parameter(
            endpoint_id=ep_get.id,
            name="petId",
            location="path",
            type="string",
            required=True,
            description="The unique ID of the pet to retrieve.",
        ))

        # ── Responses ──────────────────────────────────────────────────────────
        db.add(Response(
            endpoint_id=ep_list.id,
            status_code="200",
            description="A list of pets.",
            example='[{"id": "p1", "name": "Fido", "species": "dog", "age": 3}]',
        ))
        db.add(Response(
            endpoint_id=ep_create.id,
            status_code="201",
            description="Pet created successfully.",
            example='{"id": "p2", "name": "Whiskers", "species": "cat", "age": 2}',
        ))
        db.add(Response(
            endpoint_id=ep_get.id,
            status_code="200",
            description="A single pet.",
            example='{"id": "p1", "name": "Fido", "species": "dog", "age": 3}',
        ))
        db.add(Response(
            endpoint_id=ep_get.id,
            status_code="404",
            description="Pet not found.",
            example='{"error": {"code": 404, "message": "Pet not found"}}',
        ))

        # ── Schema ─────────────────────────────────────────────────────────────
        schema = Schema(project_id=project.id, name="Pet")
        db.add(schema)
        db.flush()

        db.add_all([
            SchemaField(
                schema_id=schema.id,
                name="id",
                type="string",
                required=True,
                description="Unique pet identifier.",
            ),
            SchemaField(
                schema_id=schema.id,
                name="name",
                type="string",
                required=True,
                description="The pet's name.",
            ),
            SchemaField(
                schema_id=schema.id,
                name="species",
                type="string",
                required=True,
                description="Species (dog, cat, bird, etc.).",
            ),
            SchemaField(
                schema_id=schema.id,
                name="age",
                type="integer",
                required=False,
                description="Age in years.",
            ),
        ])

        db.commit()
        print(f"✓ Seeded project '{project.name}' (id={project.id})")
        print(f"  3 endpoints  (GET /pets, POST /pets, GET /pets/{{petId}})")
        print(f"  4 responses")
        print(f"  1 schema 'Pet' with 4 fields")

    except Exception as exc:
        db.rollback()
        print(f"✗ Seed failed: {exc}", file=sys.stderr)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
