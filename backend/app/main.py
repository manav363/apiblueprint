from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .core.config import settings
from .routes import projects, endpoints, spec, schemas

app = FastAPI(
    title="APIBlueprint API",
    description="Backend for the APIBlueprint visual API design studio",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router)
app.include_router(endpoints.router)
app.include_router(spec.router)
app.include_router(schemas.router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "apiblueprint-backend"}
