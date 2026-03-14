"""
Configuration settings using Pydantic Settings
"""
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # MongoDB
    mongodb_url: str = "mongodb://localhost:27017"
    database_name: str = "nexus"
    
    # JWT
    secret_key: str = "nexus_super_secret_key_change_in_production_2024"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440  # 24 hours
    
    # Super Admin
    super_admin_email: str = "mohammadbisherbitar@gmail.com"
    super_admin_password: str = "mohammad2004"
    super_admin_username: str = "Shadow"
    
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
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()
