"""
ContractLens — Application Configuration
All settings loaded from environment variables via pydantic-settings.
Sensitive values (API keys, secrets) must never be hardcoded here.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",  # Ignore unknown env vars (e.g. LANGCHAIN_*, etc.)
    )

    # --- Database ---
    database_url: str = "postgresql://ContractLens:ContractLens_secret@localhost:5432/ContractLens_db"

    # --- Redis ---
    redis_url: str = "redis://localhost:6379/0"

    # --- Groq LLM ---
    groq_api_key: str = ""
    groq_model: str = "qwen/qwen3.8-27b"

    # --- Auth ---
    secret_key: str = "change-this-secret-key"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440  # 24 hours

    # --- Encryption (for MCP credentials at rest) ---
    encryption_key: str = ""  # 32-byte base64-encoded key

    # --- Business Rules (externally configurable — NFR-9) ---
    approval_threshold_usd: float = 5000.0
    llm_confidence_threshold: float = 0.6
    verification_days: int = 30
    scan_schedule_cron: str = "0 2 * * *"
    max_contracts_per_scan: int = 50  # LLM Budget Cap (NFR-7)

    # --- MCP ---
    mock_mcp: bool = True  # True = use mock stubs, no live credentials needed

    # --- Email ---
    mail_username: str = ""
    mail_password: str = ""
    mail_from: str = "noreply@ContractLens.ai"
    mail_port: int = 587
    mail_server: str = "smtp.gmail.com"
    mail_starttls: bool = True
    mail_ssl_tls: bool = False

    # --- Frontend ---
    frontend_url: str = "http://localhost:3000"



    # --- LangSmith Tracing (optional) ---
    langchain_tracing_v2: str = "false"
    langchain_project: str = "ContractLens"
    langchain_api_key: str = ""


@lru_cache()
def get_settings() -> Settings:
    """Returns a cached singleton Settings instance."""
    return Settings()


settings = get_settings()

