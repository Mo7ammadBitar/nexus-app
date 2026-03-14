"""
Message Model for Channel Messages
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class AttachmentType(str, Enum):
    """Message attachment types"""
    IMAGE = "image"
    AUDIO = "audio"
    PDF = "pdf"
    FILE = "file"
    VOICE = "voice"  # Voice message type


class MessageAttachment(BaseModel):
    """Message attachment"""
    type: AttachmentType
    url: str
    filename: str
    size: int


class MessageCreate(BaseModel):
    """Create message request"""
    content: str = Field(..., min_length=1, max_length=2000)


class MessageResponse(BaseModel):
    """Message response"""
    id: str = Field(..., alias="_id")
    channel_id: str
    user_id: str
    content: str
    attachments: List[MessageAttachment] = []
    timestamp: datetime
    
    # User info
    username: Optional[str] = None
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    
    # Forwarding info
    is_forwarded: bool = False
    forward_origin_id: Optional[str] = None
    forward_server_name: Optional[str] = None
    
    # Pinning
    is_pinned: bool = False
    
    class Config:
        populate_by_name = True


class MessageInDB(BaseModel):
    """Message model as stored in database"""
    id: Optional[str] = Field(None, alias="_id")
    channel_id: str
    user_id: str
    content: str
    attachments: List[dict] = []
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    # Forwarding info
    is_forwarded: bool = False
    forward_origin_id: Optional[str] = None
    forward_server_name: Optional[str] = None
    
    # Pinning
    is_pinned: bool = False
    
    class Config:
        populate_by_name = True
