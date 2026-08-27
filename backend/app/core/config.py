import os
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Prism News AI"
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"
    API_V1_STR: str = "/api/v1"

    # Admin Telegram Configuration
    ADMIN_TELEGRAM_USERNAME: str = "Not_Hleb"
    ADMIN_TELEGRAM_ID: int = 6541226081

    # Custom Premium Emoji ID for Brand Icon
    TELEGRAM_CUSTOM_EMOJI_ID: str = "5222200612938099305"

    # RouterAI / OpenAI-compatible Gateway
    ROUTERAI_API_KEY: str = "sk-S6nOQgQOO7RfoTwWXMWHAjyGXH8kiXxu"
    ROUTERAI_BASE_URL: str = "https://routerai.ru/api/v1"
    
    # AI Models Architecture (Primary: z-ai/glm-5.3-flash with 3 retries, Fallback: openai/gpt-4o-mini)
    EMBEDDING_MODEL: str = "openai/text-embedding-3-small"
    CHEAP_LLM_MODEL: str = "z-ai/glm-5.3-flash"
    LLM_MODEL: str = "z-ai/glm-5.3-flash"
    FALLBACK_LLM_MODEL: str = "openai/gpt-4o-mini"
    EMBEDDING_DIMENSION: int = 1536
    IMPORTANCE_THRESHOLD: int = 6

    # SOCKS5 Proxy for News Parser
    PROXY_URL: Optional[str] = "socks5://nnpA9B:8VTTJM@85.195.81.147:10108"

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./prism_news.db"
    
    # Scheduler Intervals
    PARSE_INTERVAL_MINUTES: int = 10
    LLM_ANALYSIS_INTERVAL_MINUTES: int = 25
    RECALCULATE_TRUST_INTERVAL_HOURS: int = 24

    # Clustering settings (calibrated for cosine similarity of multilingual text-embedding-3-small)
    SIMILARITY_THRESHOLD: float = 0.52
    LOOKBACK_HOURS: int = 48

    # Telegram Bot & Channel Integration
    TELEGRAM_BOT_TOKEN: str = "8940282710:AAG8d_Gd7jBpEv6WnahJoGmjQnRoEuoqtEE"
    TELEGRAM_BOT_USERNAME: str = "PrismNewsBot"
    TELEGRAM_CHANNEL_ID: str = "-1003980763210"
    TELEGRAM_DISCUSSION_GROUP_ID: str = "-1004482038811"
    AUTO_POST_TO_CHANNEL: bool = True
    SYNC_TELEGRAM_COMMENTS: bool = True

    # Security & CORS
    SECRET_KEY: str = "prism_ultra_secret_jwt_key_2026"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 30
    ADMIN_TELEGRAM_IDS: List[int] = [6541226081]
    ADMIN_USERNAMES: List[str] = ["not_hleb", "Not_Hleb"]
    CORS_ORIGINS: List[str] = ["*"]

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True
    )


settings = Settings()
