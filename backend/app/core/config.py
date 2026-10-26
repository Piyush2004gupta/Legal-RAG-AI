"""
Application Configuration - reads from environment variables only.
"""
from functools import lru_cache
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # OpenAI
    OPENAI_API_KEY: str
    OPENAI_CHAT_MODEL: str = "gpt-4o"
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-large"
    OPENAI_EMBEDDING_DIMENSIONS: int = 3072  # text-embedding-3-large

    # Database (optional - embedded store used when not configured)
    DATABASE_URL: Optional[str] = None

    # Redis (optional - in-memory task runner used when not configured)
    REDIS_URL: Optional[str] = None

    # Storage
    STORAGE_PATH: str = "./storage"

    # App
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "info"
    SECRET_KEY: str = "change-me-in-production"

    # CORS
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://frontend:3000",
    ]

    # Upload limits
    MAX_UPLOAD_SIZE_MB: int = 50
    ALLOWED_MIME_TYPES: List[str] = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
        "image/jpeg",
        "image/png",
        "image/tiff",
        "image/webp",
    ]

    # RAG settings
    CHUNK_SIZE: int = 800           # tokens per chunk
    CHUNK_OVERLAP: int = 150        # overlap tokens
    TOP_K_RETRIEVAL: int = 20       # chunks to retrieve
    TOP_K_RERANK: int = 8           # chunks after reranking
    SIMILARITY_THRESHOLD: float = 0.25

    # Processing
    MAX_JOB_ATTEMPTS: int = 3
    JOB_TIMEOUT_SECONDS: int = 600

    # Default workspace
    DEFAULT_WORKSPACE_ID: str = "00000000-0000-0000-0000-000000000001"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
