from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://apiblueprint:apiblueprint@db:5432/apiblueprint"
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]
    ADMIN_USERNAME: str
    ADMIN_PASSWORD: str
    ENABLE_API_DOCS: bool = False

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
