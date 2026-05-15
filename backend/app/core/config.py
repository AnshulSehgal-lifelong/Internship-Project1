from pydantic_settings import BaseSettings, SettingsConfigDict
from dotenv import load_dotenv
import os

load_dotenv()

class Settings(BaseSettings):
    app_name: str = os.getenv("APP_NAME", "TalentFlow API")
    api_v1_prefix: str = "/api/v1"
    frontend_url: str = os.getenv("FRONTEND_URL", "http://localhost:3000")
    database_url: str = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:password@localhost:5432/talentflow")
    jwt_secret_key: str = os.getenv("JWT_SECRET_KEY", "change-me-in-env")
    jwt_algorithm: str = os.getenv("JWT_ALGORITHM", "HS256")
    access_token_expire_minutes: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 30))
    refresh_token_expire_days: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", 7))
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()