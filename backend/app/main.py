from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .core.config import settings
from .core.security import require_admin
from .routes import projects, endpoints, spec, schemas

app = FastAPI(
    title="APIBlueprint API",
    description="Backend for the APIBlueprint visual API design studio",
    version="1.0.0",
    docs_url="/docs" if settings.ENABLE_API_DOCS else None,
    redoc_url="/redoc" if settings.ENABLE_API_DOCS else None,
    openapi_url="/openapi.json" if settings.ENABLE_API_DOCS else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

secured = [Depends(require_admin)]

app.include_router(projects.router, dependencies=secured)
app.include_router(endpoints.router, dependencies=secured)
app.include_router(spec.router, dependencies=secured)
app.include_router(schemas.router, dependencies=secured)


@app.get("/health")
def health():
    return {"status": "ok", "service": "apiblueprint-backend"}


@app.get("/api/session")
def get_session(username: str = Depends(require_admin)):
    return {"authenticated": True, "username": username}
