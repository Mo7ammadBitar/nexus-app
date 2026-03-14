"""
Pydantic Models for Friends and Direct Messages
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class FriendStatus(str, Enum):
    """Friend request status"""
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    BLOCKED = "blocked"


# ============ Friend Models ============

class FriendRequestResponse(BaseModel):
    """Friend request response"""
    id: str = Field(..., alias="_id")
    requester_id: str
    receiver_id: str
    status: FriendStatus
    created_at: datetime
    
    # Populated user info
    requester_username: Optional[str] = None
    requester_display_name: Optional[str] = None
    requester_avatar_url: Optional[str] = None
    receiver_username: Optional[str] = None
    receiver_display_name: Optional[str] = None
    receiver_avatar_url: Optional[str] = None
    
    class Config:
        populate_by_name = True


class FriendResponse(BaseModel):
    """Friend (accepted) response"""
    id: str
    username: str
    display_name: Optional[str]
    avatar_url: Optional[str]
    avatar_type: str = "static"
    is_online: bool = False


class FriendInDB(BaseModel):
    """Friend model as stored in database"""
    id: Optional[str] = Field(None, alias="_id")
    requester_id: str
    receiver_id: str
    status: FriendStatus = FriendStatus.PENDING
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        populate_by_name = True


# ============ Direct Message Models ============

class AttachmentType(str, Enum):
    """DM attachment types"""
    IMAGE = "image"
    AUDIO = "audio"
    PDF = "pdf"
    FILE = "file"


class Attachment(BaseModel):
    """Message attachment"""
    type: AttachmentType
    url: str
    filename: str
    size: int


class DirectMessageCreate(BaseModel):
    """Create DM request"""
    content: str = Field(..., min_length=1, max_length=2000)


class DirectMessageResponse(BaseModel):
    """DM response"""
    id: str = Field(..., alias="_id")
    sender_id: str
    receiver_id: str
    content: str
    attachments: List[Attachment] = []
    timestamp: datetime
    
    # Populated sender info
    sender_username: Optional[str] = None
    sender_display_name: Optional[str] = None
    sender_avatar_url: Optional[str] = None
    
    # Pinning
    is_pinned: bool = False
    
    class Config:
        populate_by_name = True


class DirectMessageInDB(BaseModel):
    """DM model as stored in database"""
    id: Optional[str] = Field(None, alias="_id")
    sender_id: str
    receiver_id: str
    content: str
    attachments: List[dict] = []
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    # Pinning
    is_pinned: bool = False
    
    class Config:
        populate_by_name = True
