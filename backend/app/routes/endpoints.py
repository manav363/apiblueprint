from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, selectinload

from ..core.database import get_db
from ..models.models import Endpoint, Parameter, Project, Response
from ..models.schemas import (
    EndpointCreate,
    EndpointOut,
    EndpointUpdate,
    ErrorEnvelope,
    ParameterCreate,
    ParameterOut,
    ParameterUpdate,
    ResponseCreate,
    ResponseOut,
    ResponseUpdate,
)

router = APIRouter(tags=["Endpoints"])


def _not_found(resource: str) -> dict:
    return {404: {"model": ErrorEnvelope, "description": f"{resource} not found"}}


# ── Endpoints ──────────────────────────────────────────────────────────────────


@router.post(
    "/projects/{project_id}/endpoints",
    response_model=EndpointOut,
    status_code=201,
    summary="Create an endpoint",
    description="Add an endpoint (method + path) to a project.",
    responses=_not_found("Project"),
)
def create_endpoint(project_id: int, payload: EndpointCreate, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    endpoint = Endpoint(project_id=project_id, **payload.model_dump())
    db.add(endpoint)
    db.commit()
    db.refresh(endpoint)
    return endpoint


@router.get(
    "/projects/{project_id}/endpoints",
    response_model=list[EndpointOut],
    summary="List a project's endpoints",
)
def list_endpoints(
    project_id: int,
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(500, ge=1, le=1000, description="Maximum number of records to return"),
    db: Session = Depends(get_db),
):
    # Eager-load parameters and responses so serializing EndpointOut doesn't
    # fire a query per endpoint (N+1).
    return (
        db.query(Endpoint)
        .filter(Endpoint.project_id == project_id)
        .options(selectinload(Endpoint.parameters), selectinload(Endpoint.responses))
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.get(
    "/endpoints/{endpoint_id}",
    response_model=EndpointOut,
    summary="Get an endpoint",
    responses=_not_found("Endpoint"),
)
def get_endpoint(endpoint_id: int, db: Session = Depends(get_db)):
    ep = db.query(Endpoint).filter(Endpoint.id == endpoint_id).first()
    if not ep:
        raise HTTPException(status_code=404, detail="Endpoint not found")
    return ep


@router.put(
    "/endpoints/{endpoint_id}",
    response_model=EndpointOut,
    summary="Update an endpoint",
    responses=_not_found("Endpoint"),
)
def update_endpoint(endpoint_id: int, payload: EndpointUpdate, db: Session = Depends(get_db)):
    ep = db.query(Endpoint).filter(Endpoint.id == endpoint_id).first()
    if not ep:
        raise HTTPException(status_code=404, detail="Endpoint not found")
    for key, val in payload.model_dump(exclude_none=True).items():
        setattr(ep, key, val)
    db.commit()
    db.refresh(ep)
    return ep


@router.delete(
    "/endpoints/{endpoint_id}",
    status_code=204,
    summary="Delete an endpoint",
    responses=_not_found("Endpoint"),
)
def delete_endpoint(endpoint_id: int, db: Session = Depends(get_db)):
    ep = db.query(Endpoint).filter(Endpoint.id == endpoint_id).first()
    if not ep:
        raise HTTPException(status_code=404, detail="Endpoint not found")
    db.delete(ep)
    db.commit()


# ── Parameters ─────────────────────────────────────────────────────────────────


@router.post(
    "/endpoints/{endpoint_id}/parameters",
    response_model=ParameterOut,
    status_code=201,
    summary="Add a parameter to an endpoint",
    responses=_not_found("Endpoint"),
)
def create_parameter(endpoint_id: int, payload: ParameterCreate, db: Session = Depends(get_db)):
    ep = db.query(Endpoint).filter(Endpoint.id == endpoint_id).first()
    if not ep:
        raise HTTPException(status_code=404, detail="Endpoint not found")
    param = Parameter(endpoint_id=endpoint_id, **payload.model_dump())
    db.add(param)
    db.commit()
    db.refresh(param)
    return param


@router.put(
    "/parameters/{param_id}",
    response_model=ParameterOut,
    summary="Update a parameter",
    responses=_not_found("Parameter"),
)
def update_parameter(param_id: int, payload: ParameterUpdate, db: Session = Depends(get_db)):
    param = db.query(Parameter).filter(Parameter.id == param_id).first()
    if not param:
        raise HTTPException(status_code=404, detail="Parameter not found")
    for key, val in payload.model_dump(exclude_none=True).items():
        setattr(param, key, val)
    db.commit()
    db.refresh(param)
    return param


@router.delete(
    "/parameters/{param_id}",
    status_code=204,
    summary="Delete a parameter",
    responses=_not_found("Parameter"),
)
def delete_parameter(param_id: int, db: Session = Depends(get_db)):
    param = db.query(Parameter).filter(Parameter.id == param_id).first()
    if not param:
        raise HTTPException(status_code=404, detail="Parameter not found")
    db.delete(param)
    db.commit()


# ── Responses ──────────────────────────────────────────────────────────────────


@router.post(
    "/endpoints/{endpoint_id}/responses",
    response_model=ResponseOut,
    status_code=201,
    summary="Add a response to an endpoint",
    description="Document a response (status code + example) for an endpoint.",
    responses=_not_found("Endpoint"),
)
def create_response(endpoint_id: int, payload: ResponseCreate, db: Session = Depends(get_db)):
    ep = db.query(Endpoint).filter(Endpoint.id == endpoint_id).first()
    if not ep:
        raise HTTPException(status_code=404, detail="Endpoint not found")
    resp = Response(endpoint_id=endpoint_id, **payload.model_dump())
    db.add(resp)
    db.commit()
    db.refresh(resp)
    return resp


@router.put(
    "/responses/{response_id}",
    response_model=ResponseOut,
    summary="Update a response",
    responses=_not_found("Response"),
)
def update_response(response_id: int, payload: ResponseUpdate, db: Session = Depends(get_db)):
    resp = db.query(Response).filter(Response.id == response_id).first()
    if not resp:
        raise HTTPException(status_code=404, detail="Response not found")
    for key, val in payload.model_dump(exclude_none=True).items():
        setattr(resp, key, val)
    db.commit()
    db.refresh(resp)
    return resp


@router.delete(
    "/responses/{response_id}",
    status_code=204,
    summary="Delete a response",
    responses=_not_found("Response"),
)
def delete_response(response_id: int, db: Session = Depends(get_db)):
    resp = db.query(Response).filter(Response.id == response_id).first()
    if not resp:
        raise HTTPException(status_code=404, detail="Response not found")
    db.delete(resp)
    db.commit()
