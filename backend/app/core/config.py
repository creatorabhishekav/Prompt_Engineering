from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """Application settings loaded from environment / .env file."""

    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    BASE_DIR: Path = BASE_DIR
    APP_NAME: str = "Match That Image API"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str = "sqlite:///./match_that_image.db"
    AUTO_CREATE_TABLES: bool = True

    # Auth / JWT
    JWT_SECRET: str = "dev-secret-change-me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    # CORS
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Firebase
    FIREBASE_CREDENTIALS_PATH: str = ""
    FIREBASE_CREDENTIALS_JSON: str = ""
    FIREBASE_PROJECT_ID: str = ""
    USE_FIRESTORE: bool = True

    # Supabase (later phases)
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    # AI provider abstraction
    AI_PROVIDER: str = "demo"
    AI_API_KEY: str = ""
    AI_MODE: str = "demo"
    IMAGE_EVALUATOR: str = "ml"

    # Target-image storage
    # "local" (default) stores uploaded images under MEDIA_ROOT and serves
    # them from the /media mount. "supabase" requires real credentials and is
    # a placeholder until a later phase wires it up.
    STORAGE_PROVIDER: str = "local"
    MEDIA_ROOT: str = str(BASE_DIR / "media")
    # Target and Participant upload limit configurations
    MAX_TARGET_IMAGE_MB: int = 20
    MAX_PARTICIPANT_IMAGE_MB: int = 20
    MAX_UPLOAD_MB: int = 20

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def is_demo_mode(self) -> bool:
        return self.AI_MODE.lower() == "demo"

    @property
    def max_target_upload_bytes(self) -> int:
        return self.MAX_TARGET_IMAGE_MB * 1024 * 1024

    @property
    def max_participant_upload_bytes(self) -> int:
        return self.MAX_PARTICIPANT_IMAGE_MB * 1024 * 1024

    @property
    def max_upload_bytes(self) -> int:
        return self.MAX_UPLOAD_MB * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()