from functools import lru_cache
from pathlib import Path
from typing import List, Union
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

BASE_DIR = Path(__file__).resolve().parent.parent.parent

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_NAME: str = "PROMPT ENGINEERING"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    BASE_DIR: Path = BASE_DIR
    MEDIA_ROOT: str = str(BASE_DIR / "media")
    MAX_UPLOAD_MB: int = 20

    # Firebase / Firestore
    FIREBASE_PROJECT_ID: str = "prompt-559ce"
    FIREBASE_CREDENTIALS_PATH: str = ""
    FIREBASE_STORAGE_BUCKET: str = "prompt-559ce.appspot.com"

    # Database & Storage
    DATABASE_URL: str = "sqlite:///./prompt_engineering.db"
    AUTO_CREATE_TABLES: bool = True
    STORAGE_PROVIDER: str = "local"

    # CORS
    CORS_ORIGINS: Union[str, List[str]] = Field(
        default=["http://localhost:5173", "http://localhost:3000", "https://prompt-engineering-2901.vercel.app"]
    )

    # ML / AI Evaluator
    IMAGE_EVALUATOR: str = "clip_cv_hybrid"
    AI_MODE: str = "hybrid"
    AI_PROVIDER: str = "gemini"
    AI_API_KEY: str = ""

    @property
    def cors_origin_list(self) -> List[str]:
        if isinstance(self.CORS_ORIGINS, str):
            return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]
        return self.CORS_ORIGINS

@lru_cache
def get_settings() -> Settings:
    return Settings()
