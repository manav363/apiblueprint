from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from .core.config import settings
from .core.logging import get_logger, setup_logging
from .core.security import authenticate_admin, create_access_token, require_admin
from .models.schemas import LoginRequest, TokenOut
from .routes import endpoints, projects, schemas, spec


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging(settings.LOG_LEVEL)
    logger = get_logger("startup")
    logger.info("api_blueprint_starting", version="1.0.0")
    yield
    logger.info("api_blueprint_shutting_down")


limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[f"{settings.RATE_LIMIT_PER_MINUTE}/minute"],
    enabled=settings.RATE_LIMIT_ENABLED,
)

app = FastAPI(
    title="APIBlueprint API",
    description="Backend for the APIBlueprint visual API design studio",
    version="1.0.0",
    docs_url="/docs" if settings.ENABLE_API_DOCS else None,
    redoc_url="/redoc" if settings.ENABLE_API_DOCS else None,
    openapi_url="/openapi.json" if settings.ENABLE_API_DOCS else None,
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

_app_logger = get_logger("api")


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    _app_logger.warning(
        "http_exception",
        status_code=exc.status_code,
        detail=exc.detail,
        path=request.url.path,
        method=request.method,
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {"code": exc.status_code, "message": exc.detail},
        },
        headers=getattr(exc, "headers", None),
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    _app_logger.error(
        "unhandled_exception",
        error=str(exc),
        path=request.url.path,
        method=request.method,
        exc_info=True,
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "code": 500,
                "message": "An unexpected error occurred. Please try again later.",
            },
        },
    )


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    _app_logger.info("request_started", method=request.method, path=request.url.path)
    response = await call_next(request)
    _app_logger.info(
        "request_finished",
        method=request.method,
        path=request.url.path,
        status_code=response.status_code,
    )
    return response


@app.middleware("http")
async def request_size_limit_middleware(request: Request, call_next):
    max_bytes = settings.MAX_REQUEST_BODY_SIZE_MB * 1024 * 1024
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > max_bytes:
        return JSONResponse(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            content={
                "error": {
                    "code": 413,
                    "message": f"Request body exceeds {settings.MAX_REQUEST_BODY_SIZE_MB}MB limit",
                },
            },
        )
    return await call_next(request)


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

if settings.ALLOWED_HOSTS:
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=[h.strip() for h in settings.ALLOWED_HOSTS.split(",") if h.strip()],
    )

secured = [Depends(require_admin)]

app.include_router(projects.router, dependencies=secured)
app.include_router(endpoints.router, dependencies=secured)
app.include_router(spec.router, dependencies=secured)
app.include_router(schemas.router, dependencies=secured)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "apiblueprint-backend",
    }


@app.post("/api/auth/login", response_model=TokenOut)
@limiter.limit("10/minute")
def login(request: Request, payload: LoginRequest):
    if not authenticate_admin(payload.username, payload.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return create_access_token(payload.username)


@app.get("/api/session")
def get_session(username: str = Depends(require_admin)):
    return {"authenticated": True, "username": username}
