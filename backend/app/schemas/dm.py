"""
Direct Messages Schemas
"""
from pydantic import BaseModel, Field
from typing import Optional, List


class SendMessageRequest(BaseModel):
    """Send DM request"""
    content: str = Field(..., min_length=1, max_length=2000)


class ConversationQuery(BaseModel):
    """Query parameters for conversation"""
    limit: int = Field(default=50, ge=1, le=100)
    before_id: Optional[str] = None
