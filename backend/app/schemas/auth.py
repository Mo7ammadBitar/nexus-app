"""
Authentication Schemas - Request/Response Models
"""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional


class LoginRequest(BaseModel):
    """Login request model"""
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """Token response after successful login"""
    access_token: str
    token_type: str = "bearer"
    user_id: str
    username: str
    role: str


class RegisterRequest(BaseModel):
    """User registration request"""
    username: str = Field(..., min_length=3, max_length=32, pattern=r"^[a-zA-Z0-9_]+$")
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=100)


class RegisterResponse(BaseModel):
    """Registration success response"""
    message: str = "User registered successfully"
    user_id: str
    username: str


class ErrorResponse(BaseModel):
    """Error response model"""
    detail: str
