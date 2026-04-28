from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..core.database import get_db
from ..models.models import Endpoint, Parameter, Response, Project
from ..models.schemas import (
    EndpointCreate, EndpointUpdate, EndpointOut,
    ParameterCreate, ParameterUpdate, ParameterOut,
    ResponseCreate, ResponseUpdate, ResponseOut,
)

router = APIRouter(tags=["Endpoints"])


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/api/projects/{project_id}/endpoints", response_model=EndpointOut, status_code=201)
def create_endpoint(project_id: int, payload: EndpointCreate, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    endpoint = Endpoint(project_id=project_id, **payload.model_dump())
    db.add(endpoint)
    db.commit()
    db.refresh(endpoint)
    return endpoint


@router.get("/api/projects/{project_id}/endpoints", response_model=list[EndpointOut])
def list_endpoints(project_id: int, db: Session = Depends(get_db)):
    return db.query(Endpoint).filter(Endpoint.project_id == project_id).all()


@router.get("/api/endpoints/{endpoint_id}", response_model=EndpointOut)
def get_endpoint(endpoint_id: int, db: Session = Depends(get_db)):
    ep = db.query(Endpoint).filter(Endpoint.id == endpoint_id).first()
    if not ep:
        raise HTTPException(status_code=404, detail="Endpoint not found")
    return ep


@router.put("/api/endpoints/{endpoint_id}", response_model=EndpointOut)
def update_endpoint(endpoint_id: int, payload: EndpointUpdate, db: Session = Depends(get_db)):
    ep = db.query(Endpoint).filter(Endpoint.id == endpoint_id).first()
    if not ep:
        raise HTTPException(status_code=404, detail="Endpoint not found")
    for key, val in payload.model_dump(exclude_none=True).items():
        setattr(ep, key, val)
    db.commit()
    db.refresh(ep)
    return ep


@router.delete("/api/endpoints/{endpoint_id}", status_code=204)
def delete_endpoint(endpoint_id: int, db: Session = Depends(get_db)):
    ep = db.query(Endpoint).filter(Endpoint.id == endpoint_id).first()
    if not ep:
        raise HTTPException(status_code=404, detail="Endpoint not found")
    db.delete(ep)
    db.commit()


# ── Parameters ─────────────────────────────────────────────────────────────────

@router.post("/api/endpoints/{endpoint_id}/parameters", response_model=ParameterOut, status_code=201)
def create_parameter(endpoint_id: int, payload: ParameterCreate, db: Session = Depends(get_db)):
    ep = db.query(Endpoint).filter(Endpoint.id == endpoint_id).first()
    if not ep:
        raise HTTPException(status_code=404, detail="Endpoint not found")
    param = Parameter(endpoint_id=endpoint_id, **payload.model_dump())
    db.add(param)
    db.commit()
    db.refresh(param)
    return param


@router.put("/api/parameters/{param_id}", response_model=ParameterOut)
def update_parameter(param_id: int, payload: ParameterUpdate, db: Session = Depends(get_db)):
    param = db.query(Parameter).filter(Parameter.id == param_id).first()
    if not param:
        raise HTTPException(status_code=404, detail="Parameter not found")
    for key, val in payload.model_dump(exclude_none=True).items():
        setattr(param, key, val)
    db.commit()
    db.refresh(param)
    return param


@router.delete("/api/parameters/{param_id}", status_code=204)
def delete_parameter(param_id: int, db: Session = Depends(get_db)):
    param = db.query(Parameter).filter(Parameter.id == param_id).first()
    if not param:
        raise HTTPException(status_code=404, detail="Parameter not found")
    db.delete(param)
    db.commit()


# ── Responses ──────────────────────────────────────────────────────────────────

@router.post("/api/endpoints/{endpoint_id}/responses", response_model=ResponseOut, status_code=201)
def create_response(endpoint_id: int, payload: ResponseCreate, db: Session = Depends(get_db)):
    ep = db.query(Endpoint).filter(Endpoint.id == endpoint_id).first()
    if not ep:
        raise HTTPException(status_code=404, detail="Endpoint not found")
    resp = Response(endpoint_id=endpoint_id, **payload.model_dump())
    db.add(resp)
    db.commit()
    db.refresh(resp)
    return resp


@router.put("/api/responses/{response_id}", response_model=ResponseOut)
def update_response(response_id: int, payload: ResponseUpdate, db: Session = Depends(get_db)):
    resp = db.query(Response).filter(Response.id == response_id).first()
    if not resp:
        raise HTTPException(status_code=404, detail="Response not found")
    for key, val in payload.model_dump(exclude_none=True).items():
        setattr(resp, key, val)
    db.commit()
    db.refresh(resp)
    return resp


@router.delete("/api/responses/{response_id}", status_code=204)
def delete_response(response_id: int, db: Session = Depends(get_db)):
    resp = db.query(Response).filter(Response.id == response_id).first()
    if not resp:
        raise HTTPException(status_code=404, detail="Response not found")
    db.delete(resp)
    db.commit()