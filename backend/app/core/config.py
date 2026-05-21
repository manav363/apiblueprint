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

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
