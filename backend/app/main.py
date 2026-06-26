import hashlib
import signal
import time
import uuid
from contextlib import asynccontextmanager

import structlog
from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse, Response
from prometheus_fastapi_instrumentator import Instrumentator
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from sqlalchemy import text

from .core import idempotency
from .core.config import API_V1_PREFIX, settings
from .core.database import SessionLocal
from .core.logging import get_logger, setup_logging
from .core.observability import init_sentry
from .core.security import authenticate_admin, create_access_token, require_admin
from .models.schemas import LoginRequest, TokenOut
from .routes import endpoints, projects, schemas, spec, validate

_shutdown_logger = None


def _handle_sigterm(signum, frame):
    if _shutdown_logger:
        _shutdown_logger.info("sigterm_received", action="draining_requests")


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _shutdown_logger
    setup_logging(settings.LOG_LEVEL)
    logger = get_logger("startup")
    _shutdown_logger = get_logger("shutdown")
    # Signal handlers can only be installed on the main thread; under test portals
    # or some embedded servers the lifespan runs elsewhere, so degrade gracefully.
    try:
        signal.signal(signal.SIGTERM, _handle_sigterm)
    except ValueError:
        logger.warning("sigterm_handler_not_registered", reason="not_main_thread")
    logger.info("api_blueprint_starting", version="1.0.0")
    yield
    _shutdown_logger.info("api_blueprint_shutting_down")


# Initialize Sentry before the app is created so its integration can wrap it.
init_sentry()

# Use Redis as the rate-limit store when configured so limits hold across
# multiple backend processes/replicas; otherwise fall back to in-process memory.
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[f"{settings.RATE_LIMIT_PER_MINUTE}/minute"],
    enabled=settings.RATE_LIMIT_ENABLED,
    storage_uri=settings.REDIS_URL or "memory://",
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


def _trace_id(request: Request) -> str | None:
    return getattr(request.state, "trace_id", None)


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
            "error": {
                "code": exc.status_code,
                "message": exc.detail,
                "trace_id": _trace_id(request),
            },
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
                "trace_id": _trace_id(request),
            },
        },
    )


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    # HSTS is only meaningful over HTTPS; emit it when the edge terminated TLS.
    forwarded_proto = request.headers.get("x-forwarded-proto", request.url.scheme)
    if forwarded_proto == "https":
        response.headers.setdefault(
            "Strict-Transport-Security",
            f"max-age={settings.HSTS_MAX_AGE_SECONDS}; includeSubDomains",
        )
    return response


@app.middleware("http")
async def idempotency_middleware(request: Request, call_next):
    """Replay the first response for any POST carrying an ``Idempotency-Key``.

    A client that retries a creation after a dropped connection gets the
    original resource back instead of creating a duplicate.
    """
    key = request.headers.get("Idempotency-Key")
    if request.method != "POST" or not key:
        return await call_next(request)

    fingerprint = hashlib.sha256(f"{request.method}:{request.url.path}".encode()).hexdigest()
    stored = idempotency.store.get(key)
    if stored is not None:
        if stored.request_fingerprint != fingerprint:
            return JSONResponse(
                status_code=status.HTTP_409_CONFLICT,
                content={
                    "error": {
                        "code": 409,
                        "message": "Idempotency-Key was already used for a different request",
                        "trace_id": _trace_id(request),
                    },
                },
            )
        return Response(
            content=stored.body,
            status_code=stored.status_code,
            media_type=stored.media_type,
            headers={"Idempotency-Replayed": "true"},
        )

    response = await call_next(request)
    body = b"".join([chunk async for chunk in response.body_iterator])
    # Only cache successful creations — failures should be retryable.
    if 200 <= response.status_code < 300:
        idempotency.store.put(
            key,
            response.status_code,
            body,
            response.media_type or "application/json",
            fingerprint,
        )
    return Response(
        content=body,
        status_code=response.status_code,
        headers=dict(response.headers),
        media_type=response.media_type,
    )


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
                    "trace_id": _trace_id(request),
                },
            },
        )
    return await call_next(request)


# Defined last so it is the outermost custom middleware: it stamps a trace_id and
# timing onto every response, including the early returns above.
@app.middleware("http")
async def trace_context_middleware(request: Request, call_next):
    trace_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex
    request.state.trace_id = trace_id
    structlog.contextvars.bind_contextvars(trace_id=trace_id)
    started = time.perf_counter()
    try:
        _app_logger.info("request_started", method=request.method, path=request.url.path)
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - started) * 1000
        response.headers["X-Request-ID"] = trace_id
        response.headers["X-Response-Time"] = f"{elapsed_ms:.1f}ms"
        _app_logger.info(
            "request_finished",
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=round(elapsed_ms, 1),
        )
        return response
    finally:
        structlog.contextvars.clear_contextvars()


app.add_middleware(GZipMiddleware, minimum_size=settings.GZIP_MIN_SIZE_BYTES)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Idempotency-Key", "X-Request-ID"],
    expose_headers=["X-Request-ID", "X-Response-Time", "Idempotency-Replayed"],
)

if settings.ALLOWED_HOSTS:
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=[h.strip() for h in settings.ALLOWED_HOSTS.split(",") if h.strip()],
    )

secured = [Depends(require_admin)]

app.include_router(projects.router, prefix=API_V1_PREFIX, dependencies=secured)
app.include_router(endpoints.router, prefix=API_V1_PREFIX, dependencies=secured)
app.include_router(spec.router, prefix=API_V1_PREFIX, dependencies=secured)
app.include_router(schemas.router, prefix=API_V1_PREFIX, dependencies=secured)

# Stateless spec linter — unauthenticated, but still subject to the global rate
# limiter and request-body-size cap.
app.include_router(validate.router)

# Prometheus metrics: request counts, latencies, and sizes at /metrics (unauthenticated,
# meant to be scraped from inside the network — keep the port bound to localhost).
if settings.METRICS_ENABLED:
    Instrumentator().instrument(app).expose(app, endpoint="/metrics", include_in_schema=settings.ENABLE_API_DOCS)


@app.get("/health", tags=["Health"], summary="Basic health check")
def health():
    return {"status": "ok", "service": "apiblueprint-backend"}


@app.get("/health/live", tags=["Health"], summary="Liveness probe")
def health_live():
    """Liveness — confirms the process is running."""
    return {"status": "ok"}


@app.get(
    "/health/ready",
    tags=["Health"],
    summary="Readiness probe",
    responses={503: {"description": "Database not reachable"}},
)
def health_ready():
    """Readiness — confirms the process can serve traffic (DB reachable)."""
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
    except Exception as exc:
        _app_logger.error("readiness_check_failed", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not reachable",
        ) from exc
    return {"status": "ok", "db": "reachable"}


@app.post(
    "/api/auth/login",
    response_model=TokenOut,
    tags=["Auth"],
    summary="Log in and obtain a JWT",
    responses={401: {"description": "Invalid username or password"}},
)
@limiter.limit("10/minute")
def login(request: Request, payload: LoginRequest):
    if not authenticate_admin(payload.username, payload.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return create_access_token(payload.username)


@app.get("/api/session", tags=["Auth"], summary="Get the current session")
def get_session(username: str = Depends(require_admin)):
    return {"authenticated": True, "username": username}
