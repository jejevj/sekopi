from typing import List, Union
from pydantic_settings import BaseSettings
from pydantic import field_validator


class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "changeme-secret-key-sekopi-2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 8   # 8 jam
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    DATABASE_URL: str = "sqlite+aiosqlite:///./sekopi.db"
    ENVIRONMENT: str = "development"

    BACKEND_CORS_ORIGINS: Union[List[str], str] = [
        # local dev
        "http://localhost:8081",
        "http://localhost:19006",
        "http://localhost:3000",
        "http://localhost:5020",
        "http://127.0.0.1:8081",
        "http://127.0.0.1:19006",
        "http://10.0.2.2:8000",
        "exp://localhost:8081",
        # production
        "https://sekopi.ourtestcloud.my.id",
        "http://sekopi.ourtestcloud.my.id",
    ]

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v):
        if isinstance(v, str):
            if v.strip() == "*":
                return ["*"]
            return [i.strip() for i in v.split(",")]
        return v

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
