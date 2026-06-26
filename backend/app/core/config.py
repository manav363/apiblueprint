from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://apiblueprint:apiblueprint@db:5432/apiblueprint"
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]
    ADMIN_USERNAME: str
    ADMIN_PASSWORD: str
    JWT_SECRET: str
    JWT_EXPIRES_MINUTES: int = 60
    ENABLE_API_DOCS: bool = False
    LOG_LEVEL: str = "INFO"
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_PER_MINUTE: int = 60
    MAX_REQUEST_BODY_SIZE_MB: int = 5
    ALLOWED_HOSTS: str | None = None
    GZIP_MIN_SIZE_BYTES: int = 500
    HSTS_MAX_AGE_SECONDS: int = 31536000  # 1 year; only emitted over HTTPS
    ENVIRONMENT: str = "development"
    METRICS_ENABLED: bool = True
    SENTRY_DSN: str | None = None
    SENTRY_TRACES_SAMPLE_RATE: float = 0.0
    # Caching / Redis. When REDIS_URL is unset, rate limiting and the spec cache
    # fall back to in-process stores, so the app runs without Redis.
    REDIS_URL: str | None = None
    SPEC_CACHE_TTL_SECONDS: int = 300

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


# All versioned data routes (projects, endpoints, schemas, spec) hang off this.
# Auth, session, and health checks stay unversioned — they are cross-cutting.
API_V1_PREFIX = "/api/v1"

settings = Settings()
