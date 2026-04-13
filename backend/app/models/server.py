"""
Pydantic Models for Servers and Channels
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class ServerRole(str, Enum):
    """Server-level roles"""
    OWNER = "owner"
    MODERATOR = "moderator"
    MEMBER = "member"


class ChannelType(str, Enum):
    """Channel types"""
    TEXT = "text"
    VOICE = "voice"


# ============ Server Models ============

class SentinelSettings(BaseModel):
    """Configuration for Nexus Sentinel bot"""
    is_enabled: bool = False
    anti_spam: bool = True
    anti_links: bool = False
    banned_words: List[str] = Field(default_factory=list)
    ai_strictness: bool = False

class ServerCreate(BaseModel):
    """Create server request"""
    name: str = Field(..., min_length=2, max_length=100)


class ServerUpdate(BaseModel):
    """Update server request"""
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    icon_url: Optional[str] = None
    banner_url: Optional[str] = None


class ServerResponse(BaseModel):
    """Server response model"""
    id: str = Field(..., alias="_id")
    name: str
    icon_url: Optional[str] = None
    banner_url: Optional[str] = None
    boost_level: int = 0
    owner_id: str
    invite_code: str
    member_count: int = 0
    sentinel_settings: Optional[SentinelSettings] = None
    created_at: datetime
    
    class Config:
        populate_by_name = True


class ServerDetailResponse(ServerResponse):
    """Detailed server response with channels"""
    channels: List[dict] = []
    my_role: str = "member"


class ServerInDB(BaseModel):
    """Server model as stored in database"""
    id: Optional[str] = Field(None, alias="_id")
    name: str
    icon_url: Optional[str] = None
    banner_url: Optional[str] = None
    boost_level: int = 0
    owner_id: str
    invite_code: str
    sentinel_settings: SentinelSettings = Field(default_factory=SentinelSettings)
    
    # Ban system
    is_banned: bool = False
    ban_reason: Optional[str] = None
    ban_expires_at: Optional[datetime] = None
    
    # Soft delete
    is_deleted: bool = False
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        populate_by_name = True


# ============ Channel Models ============

class ChannelCreate(BaseModel):
    """Create channel request"""
    name: str = Field(..., min_length=1, max_length=100)
    type: ChannelType = ChannelType.TEXT


class ChannelUpdate(BaseModel):
    """Update channel request"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)


class ChannelResponse(BaseModel):
    """Channel response model"""
    id: str = Field(..., alias="_id")
    server_id: str
    name: str
    type: ChannelType
    created_at: datetime
    
    class Config:
        populate_by_name = True


class ChannelInDB(BaseModel):
    """Channel model as stored in database"""
    id: Optional[str] = Field(None, alias="_id")
    server_id: str
    name: str
    type: ChannelType
    allowed_members: List[str] = []  # Empty = all members allowed
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        populate_by_name = True


# ============ Member Models ============

class MemberResponse(BaseModel):
    """Server member response"""
    id: str = Field(..., alias="_id")
    user_id: str
    username: str
    display_name: Optional[str]
    avatar_url: Optional[str]
    role: ServerRole
    is_muted: bool = False
    strikes: int = 0
    timeout_until: Optional[datetime] = None
    joined_at: datetime
    
    class Config:
        populate_by_name = True


class MemberInDB(BaseModel):
    """Member model as stored in database"""
    id: Optional[str] = Field(None, alias="_id")
    server_id: str
    user_id: str
    role: ServerRole = ServerRole.MEMBER
    
    # Mute system (within server)
    is_muted: bool = False
    mute_reason: Optional[str] = None
    mute_expires_at: Optional[datetime] = None
    
    # Sentinel system
    strikes: int = 0
    timeout_until: Optional[datetime] = None
    
    joined_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        populate_by_name = True


class MemberMuteRequest(BaseModel):
    """Mute member request"""
    reason: str = Field(..., min_length=5, max_length=500)
    duration_hours: Optional[int] = None  # None = permanent
