from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..models.models import Endpoint, Project
from ..models.schemas import ProjectCreate, ProjectOut, ProjectSummary, ProjectUpdate

router = APIRouter(prefix="/api/projects", tags=["Projects"])


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(payload: ProjectCreate, db: Session = Depends(get_db)):
    project = Project(**payload.model_dump())
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get("", response_model=list[ProjectSummary])
def list_projects(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=500, description="Maximum number of records to return"),
    db: Session = Depends(get_db),
):
    projects = db.query(Project).order_by(Project.created_at.desc()).offset(skip).limit(limit).all()
    result = []
    for p in projects:
        count = db.query(Endpoint).filter(Endpoint.project_id == p.id).count()
        summary = ProjectSummary(
            id=p.id,
            name=p.name,
            version=p.version,
            description=p.description,
            color=p.color,
            created_at=p.created_at,
            updated_at=p.updated_at,
            endpoint_count=count,
        )
        result.append(summary)
    return result


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.put("/{project_id}", response_model=ProjectOut)
def update_project(project_id: int, payload: ProjectUpdate, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    for key, val in payload.model_dump(exclude_none=True).items():
        setattr(project, key, val)
    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(project)
    db.commit()
