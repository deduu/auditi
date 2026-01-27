"""
Application configuration using Pydantic Settings.
Loads from environment variables or .env file.
"""
from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Database
    database_url: str = "postgresql://postgres:postgres@localhost:5433/audit_db"
    
    # Server
    debug: bool = False
    api_port: int = 8000
    api_host: str = "0.0.0.0"
    
    # CORS
    cors_origins: str = "http://localhost:5173,http://localhost:3000"
    
    # Evaluation
    truncation_limit: int = 2000  # -1 for unlimited
    truncation_strategy: str = "end"  # "end", "middle", "start"
    
    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS origins from comma-separated string."""
        return [origin.strip() for origin in self.cors_origins.split(",")]
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


# Singleton settings instance
settings = Settings()
