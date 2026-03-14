"""
Pydantic Models for Users
"""
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from datetime import datetime
from enum import Enum
from bson import ObjectId


class PyObjectId(str):
    """Custom ObjectId type for Pydantic"""
    
    @classmethod
    def __get_validators__(cls):
        yield cls.validate
    
    @classmethod
    def validate(cls, v):
        if isinstance(v, ObjectId):
            return str(v)
        if isinstance(v, str) and ObjectId.is_valid(v):
            return v
        raise ValueError("Invalid ObjectId")


class UserRole(str, Enum):
    """Application-level user roles"""
    USER = "user"
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"


class AvatarType(str, Enum):
    """Avatar type for premium distinction"""
    STATIC = "static"
    ANIMATED = "animated"


class BannerType(str, Enum):
    """Banner type for premium distinction"""
    SOLID = "solid"
    GRADIENT = "gradient"
    ANIMATED = "animated"


class UserStatus(str, Enum):
    """User presence status"""
    ONLINE = "online"
    DND = "dnd"  # Do Not Disturb
    IDLE = "idle"
    INVISIBLE = "invisible"  # Appears offline


# ============ Base Models ============

class UserBase(BaseModel):
    """Base user fields"""
    username: str = Field(..., min_length=3, max_length=32)
    email: EmailStr
    display_name: Optional[str] = None


class UserProfile(BaseModel):
    """User profile settings"""
    avatar_url: Optional[str] = None
    avatar_type: AvatarType = AvatarType.STATIC
    banner_url: Optional[str] = None
    banner_type: BannerType = BannerType.SOLID
    bio: Optional[str] = Field(None, max_length=500)
    accent_color: Optional[str] = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$')  # Hex color
    theme_color: Optional[str] = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$')    # Client theme color
    about_me: Optional[str] = Field(None, max_length=300)


# ============ Create/Update Models ============

class UserCreate(UserBase):
    """User registration model"""
    password: str = Field(..., min_length=6, max_length=100)


class UserUpdate(BaseModel):
    """User update model (for profile editing)"""
    display_name: Optional[str] = Field(None, max_length=32)
    avatar_url: Optional[str] = None
    banner_url: Optional[str] = None
    bio: Optional[str] = Field(None, max_length=500)
    accent_color: Optional[str] = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$')  # Premium only
    theme_color: Optional[str] = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$')    # Client theme color
    about_me: Optional[str] = Field(None, max_length=300)


class AdminUserCreate(BaseModel):
    """Admin creating a new user/admin"""
    username: str = Field(..., min_length=3, max_length=32)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=100)
    role: UserRole = UserRole.USER


class UserBan(BaseModel):
    """Ban user model"""
    reason: str = Field(..., min_length=10, max_length=500)
    duration_days: Optional[int] = None  # None = permanent


# ============ Response Models ============

class UserResponse(BaseModel):
    """User response model (public info)"""
    id: str = Field(..., alias="_id")
    username: str
    display_name: Optional[str] = None
    role: UserRole
    is_premium: bool = False
    premium_since: Optional[datetime] = None
    premium_expires_at: Optional[datetime] = None
    avatar_url: Optional[str] = None
    avatar_type: AvatarType = AvatarType.STATIC
    banner_url: Optional[str] = None
    banner_type: BannerType = BannerType.SOLID
    bio: Optional[str] = None
    accent_color: Optional[str] = None
    theme_color: Optional[str] = None
    about_me: Optional[str] = None
    status: UserStatus = UserStatus.ONLINE
    is_online: bool = False
    created_at: datetime
    
    # Email Verification
    is_email_verified: bool = False
    
    # Economy
    aether_shards: Optional[int] = 0
    equipped_relics: Optional[dict] = {}
    
    class Config:
        populate_by_name = True


class UserPrivateResponse(UserResponse):
    """User response with private info (for self)"""
    email: EmailStr
    is_banned: bool = False
    ban_reason: Optional[str] = None
    ban_expires_at: Optional[datetime] = None


class UserInDB(BaseModel):
    """User model as stored in database"""
    id: Optional[str] = Field(None, alias="_id")
    username: str
    email: str
    password_hash: str
    display_name: Optional[str] = None
    role: UserRole = UserRole.USER
    
    # Profile
    avatar_url: Optional[str] = None
    avatar_type: AvatarType = AvatarType.STATIC
    banner_url: Optional[str] = None
    banner_type: BannerType = BannerType.SOLID
    bio: Optional[str] = None
    
    # Premium
    is_premium: bool = False
    premium_since: Optional[datetime] = None
    premium_expires_at: Optional[datetime] = None
    accent_color: Optional[str] = None
    theme_color: Optional[str] = None
    about_me: Optional[str] = None
    
    # Economy
    aether_shards: Optional[int] = 0
    owned_relics: Optional[List[str]] = []
    equipped_relics: Optional[dict] = {}  # {"frame": "relic_id", "bubble": "relic_id"}
    
    # Ban System
    is_banned: bool = False
    ban_reason: Optional[str] = None
    ban_expires_at: Optional[datetime] = None
    
    # Soft Delete
    is_deleted: bool = False
    
    # Presence
    status: UserStatus = UserStatus.ONLINE
    is_online: bool = False
    last_seen: Optional[datetime] = None
    
    # Password Reset
    reset_password_token: Optional[str] = None
    reset_password_expires: Optional[datetime] = None
    
    # Email Verification
    is_email_verified: bool = False
    email_verification_token: Optional[str] = None
    email_verification_expires: Optional[datetime] = None
    
    # Metadata
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        populate_by_name = True
