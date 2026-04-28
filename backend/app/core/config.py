from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://apiblueprint:apiblueprint@db:5432/apiblueprint"
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000", "http://frontend:5173"]

    class Config:
        env_file = ".env"

settings = Settings()