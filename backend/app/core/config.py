from pydantic_settings import BaseSettings, SettingsConfigDict
from dotenv import load_dotenv
import os

load_dotenv()

class Settings(BaseSettings):
    """Application configuration loaded from environment variables."""
    app_name: str = os.getenv("APP_NAME", "TalentFlow API")
    api_v1_prefix: str = "/api"
    gemini_api_key: str | None = os.getenv("GEMINI_API_KEY")
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
    rag_embedding_model: str = os.getenv("RAG_EMBEDDING_MODEL", "gemini-embedding-001")
    rag_embedding_dimensions: int = int(os.getenv("RAG_EMBEDDING_DIMENSIONS", 768))
    rag_chunk_size: int = int(os.getenv("RAG_CHUNK_SIZE", 500))
    rag_chunk_overlap: int = int(os.getenv("RAG_CHUNK_OVERLAP", 100))
    rag_top_k: int = int(os.getenv("RAG_TOP_K", 5))
    rag_embedding_interval_seconds: float = float(os.getenv("RAG_EMBEDDING_INTERVAL_SECONDS", 1.0))
    ollama_host: str = os.getenv("OLLAMA_HOST", "http://localhost:11434")
    ollama_model: str = os.getenv("OLLAMA_MODEL", "llama3.1")
    database_url: str = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:password@localhost:5432/talentflow")
    jwt_secret_key: str = os.getenv("JWT_SECRET_KEY", "change-me-in-env")
    jwt_algorithm: str = os.getenv("JWT_ALGORITHM", "HS256")
    access_token_expire_minutes: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 30))
    storage_base_path: str = os.getenv("STORAGE_BASE_PATH", "storage/uploads")
    max_upload_size_mb: int = int(os.getenv("MAX_UPLOAD_SIZE_MB", 25))
    allowed_mime_types: str = os.getenv(
        "ALLOWED_MIME_TYPES",
        "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain",
    )
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
"""Centralized application configuration loaded from environment variables."""