from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..core.database import get_db
from ..models.models import Schema, SchemaField, Project
from ..models.schemas import SchemaCreate, SchemaOut, SchemaFieldCreate, SchemaFieldOut

router = APIRouter(tags=["Schemas"])


@router.post("/api/projects/{project_id}/schemas", response_model=SchemaOut, status_code=201)
def create_schema(project_id: int, payload: SchemaCreate, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    schema = Schema(project_id=project_id, **payload.model_dump())
    db.add(schema)
    db.commit()
    db.refresh(schema)
    return schema


@router.get("/api/projects/{project_id}/schemas", response_model=list[SchemaOut])
def list_schemas(project_id: int, db: Session = Depends(get_db)):
    return db.query(Schema).filter(Schema.project_id == project_id).all()


@router.delete("/api/schemas/{schema_id}", status_code=204)
def delete_schema(schema_id: int, db: Session = Depends(get_db)):
    schema = db.query(Schema).filter(Schema.id == schema_id).first()
    if not schema:
        raise HTTPException(status_code=404, detail="Schema not found")
    db.delete(schema)
    db.commit()


@router.post("/api/schemas/{schema_id}/fields", response_model=SchemaFieldOut, status_code=201)
def create_field(schema_id: int, payload: SchemaFieldCreate, db: Session = Depends(get_db)):
    schema = db.query(Schema).filter(Schema.id == schema_id).first()
    if not schema:
        raise HTTPException(status_code=404, detail="Schema not found")
    field = SchemaField(schema_id=schema_id, **payload.model_dump())
    db.add(field)
    db.commit()
    db.refresh(field)
    return field


@router.delete("/api/fields/{field_id}", status_code=204)
def delete_field(field_id: int, db: Session = Depends(get_db)):
    field = db.query(SchemaField).filter(SchemaField.id == field_id).first()
    if not field:
        raise HTTPException(status_code=404, detail="Field not found")
    db.delete(field)
    db.commit()