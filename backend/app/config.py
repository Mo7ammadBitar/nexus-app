"""
Configuration settings using Pydantic Settings

All secrets and credentials MUST be provided via environment variables.
The application will refuse to start if critical secrets are missing.
"""
from pydantic_settings import BaseSettings
from pydantic import field_validator
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # MongoDB
    mongodb_url: str = "mongodb://localhost:27017"
    database_name: str = "nexus"
    
    # JWT — NO DEFAULT: must be set in production
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440  # 24 hours
    
    # Super Admin — NO DEFAULTS: must be set via env vars
    super_admin_email: str
    super_admin_password: str
    super_admin_username: str
    
    # File Upload
    upload_dir: str = "../uploads"
    max_file_size_mb: int = 10
    
    # Email (SMTP)
    mail_username: str = ""
    mail_password: str = ""
    mail_from: str = ""
    mail_port: int = 587
    mail_server: str = "smtp.gmail.com"
    mail_starttls: bool = True
    mail_ssl_tls: bool = False
    
    # AI Config
    gemini_api_key: str = ""
    
    # Cloudinary Config (Migration)
    cloudinary_cloud_name: str = ""
    cloudinary_api_key: str = ""
    cloudinary_api_secret: str = ""
    
    # PayPal Config
    paypal_client_id: str = ""
    paypal_client_secret: str = ""
    paypal_sandbox: bool = True  # Set to False for live payments
    
    @field_validator("secret_key")
    @classmethod
    def secret_key_must_be_strong(cls, v: str) -> str:
        if not v or len(v) < 32:
            raise ValueError(
                "SECRET_KEY must be at least 32 characters. "
                "Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(64))\""
            )
        return v
    
    @field_validator("super_admin_password")
    @classmethod
    def admin_password_must_be_strong(cls, v: str) -> str:
        if not v or len(v) < 12:
            raise ValueError("SUPER_ADMIN_PASSWORD must be at least 12 characters.")
        return v
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


from pydantic import ValidationError
import sys

@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    try:
        return Settings()
    except ValidationError as e:
        print("CRITICAL ERROR: Missing or invalid environment variables!")
        for error in e.errors():
            print(f" - {error['loc'][0]}: {error['msg']}")
        sys.exit(1)
