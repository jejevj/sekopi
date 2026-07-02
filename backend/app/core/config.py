from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True)

    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "SekoPi"
    ENVIRONMENT: str = "development"

    # Database
    DATABASE_URL: str

    # JWT
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:8081", "http://localhost:3000"]

    # First superuser
    FIRST_SUPERUSER_EMAIL: str = "admin@sekopi.com"
    FIRST_SUPERUSER_PASSWORD: str = "changeme"


settings = Settings()
