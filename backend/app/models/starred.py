"""
Starred Message Model
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class MessageType(str, Enum):
    """Type of message - DM or channel message"""
    DM = "dm"
    CHANNEL = "channel"


class StarredMessageCreate(BaseModel):
    """Create starred message request"""
    message_id: str
    message_type: MessageType


class StarredMessageInDB(BaseModel):
    """Starred message as stored in database"""
    id: Optional[str] = Field(None, alias="_id")
    user_id: str
    message_id: str
    message_type: MessageType
    starred_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        populate_by_name = True


class StarredMessageResponse(BaseModel):
    """Starred message response with full message details"""
    id: str = Field(..., alias="_id")
    message_id: str
    message_type: MessageType
    starred_at: datetime
    
    # Original message data
    content: str
    timestamp: datetime
    attachments: List[Dict[str, Any]] = []
    
    # Sender info
    sender_username: Optional[str] = None
    sender_display_name: Optional[str] = None
    sender_avatar_url: Optional[str] = None
    
    # Source info (for DMs: friend info, for channels: server/channel info)
    source_name: str  # Friend name for DMs, "Server > #channel" for channels
    source_type: str  # "dm" or "channel"
    
    # Additional context for navigation
    friend_id: Optional[str] = None  # For DMs
    server_id: Optional[str] = None  # For channels
    server_name: Optional[str] = None  # For channels
    channel_id: Optional[str] = None  # For channels
    channel_name: Optional[str] = None  # For channels
    
    class Config:
        populate_by_name = True
