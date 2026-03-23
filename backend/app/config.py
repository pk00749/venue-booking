from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    APP_NAME: str = "场地预订系统"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    # WeChat
    WECHAT_APPID: str = ""
    WECHAT_SECRET: str = ""

    # MongoDB
    MONGODB_URL: str = "mongodb://localhost:27017"
    MONGODB_DB: str = "venue_booking"

    # JWT
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_HOURS: int = 24 * 7  # 7 days

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()