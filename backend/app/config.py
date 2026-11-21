import os
from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="allow",
    )

    llm_api_keys: str = ""
    database_url: str = (
        "sqlite+aiosqlite:////tmp/app.db"
        if os.environ.get("VERCEL")
        else "sqlite+aiosqlite:////data/app.db"
    )
    allowed_origins: str = "http://localhost:3000"
    enable_failure_simulation: bool = False
    default_model: str = "gemini/gemini-2.0-flash-lite"
    cache_type: str = "local"  # 'local' or 'disk'
    cache_dir: str = "/data/.litellm_cache"

    @property
    def api_keys_list(self) -> List[str]:
        return [k.strip() for k in self.llm_api_keys.split(",") if k.strip()]

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache()
def get_settings() -> Settings:
    return Settings()
