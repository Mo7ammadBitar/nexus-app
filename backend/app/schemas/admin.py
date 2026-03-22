"""
Admin Schemas - Request/Response Models
"""
from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from datetime import datetime


class CreateAdminRequest(BaseModel):
    """Create admin account request (Super Admin only)"""
    username: str = Field(..., min_length=3, max_length=32)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=100)


class CreateUserRequest(BaseModel):
    """Create user account request (Admin + Super Admin)"""
    username: str = Field(..., min_length=3, max_length=32)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=100)


class BanUserRequest(BaseModel):
    """Ban user request"""
    reason: str = Field(..., min_length=10, max_length=500)
    duration_days: Optional[int] = Field(None, ge=1, le=365)  # None = permanent


class BanServerRequest(BaseModel):
    """Ban server request"""
    reason: str = Field(..., min_length=10, max_length=500)
    duration_days: Optional[int] = Field(None, ge=1, le=365)


class UpdateUserRequest(BaseModel):
    """Update user by admin"""
    display_name: Optional[str] = Field(None, max_length=32)
    is_premium: Optional[bool] = None


class UpdateAdminRequest(BaseModel):
    """Update admin by super admin"""
    display_name: Optional[str] = Field(None, max_length=32)


class UpdateServerAdminRequest(BaseModel):
    """Update server by admin/super admin"""
    name: Optional[str] = Field(None, min_length=2, max_length=100)


class AdminUserResponse(BaseModel):
    """User response for admin dashboard"""
    id: str
    username: str
    email: str
    display_name: Optional[str]
    role: str
    is_premium: bool
    is_banned: bool
    ban_reason: Optional[str]
    ban_expires_at: Optional[datetime]
    is_deleted: bool
    created_at: datetime


class AdminServerResponse(BaseModel):
    """Server response for admin dashboard"""
    id: str
    name: str
    owner_id: str
    owner_username: Optional[str]
    invite_code: str
    member_count: int
    is_banned: bool
    ban_reason: Optional[str]
    ban_expires_at: Optional[datetime]
    created_at: datetime


class GrantPremiumRequest(BaseModel):
    """Grant premium subscription to a user"""
    plan: str = Field(..., pattern=r'^(monthly|yearly|lifetime)$')

