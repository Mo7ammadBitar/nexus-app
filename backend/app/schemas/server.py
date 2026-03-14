"""
Server Schemas - Request/Response Models
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class CreateServerRequest(BaseModel):
    """Create server request"""
    name: str = Field(..., min_length=2, max_length=100)


class UpdateServerRequest(BaseModel):
    """Update server request"""
    name: Optional[str] = Field(None, min_length=2, max_length=100)


class JoinServerRequest(BaseModel):
    """Join server by invite code"""
    invite_code: str = Field(..., min_length=4, max_length=20)


class CreateChannelRequest(BaseModel):
    """Create channel request"""
    name: str = Field(..., min_length=1, max_length=100)
    type: str = Field(default="text", pattern="^(text|voice)$")


class UpdateChannelRequest(BaseModel):
    """Update channel request"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    send_permission: Optional[str] = Field(None, pattern="^(all|mods_only)$")


class MuteRequest(BaseModel):
    """Mute member request"""
    reason: str = Field(..., min_length=5, max_length=500)
    duration_hours: Optional[int] = Field(None, ge=1, le=720)  # Max 30 days


class ChannelMemberRequest(BaseModel):
    """Add/Remove member from channel"""
    user_id: str
