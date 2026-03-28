"""
Pydantic Models for Support Tickets
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from app.models.user import PyObjectId

# ============ Ticket Models ============

class TicketBase(BaseModel):
    subject: str = Field(..., min_length=1, max_length=200)

class TicketCreate(TicketBase):
    message: str = Field(..., min_length=1) # Initial message payload on creation

class TicketInDB(TicketBase):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    user_id: str
    status: str = "open"  # 'open', 'closed', 'reopen_requested'
    reopen_reason: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        json_encoders = {PyObjectId: str}

class TicketResponse(TicketInDB):
    pass

class ReopenRequest(BaseModel):
    reason: str = Field(..., min_length=1, max_length=500)

# ============ Ticket Message Models ============

class TicketMessageBase(BaseModel):
    message: str = Field(..., min_length=1)

class TicketMessageCreate(TicketMessageBase):
    pass

class TicketMessageInDB(TicketMessageBase):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    ticket_id: str
    sender_id: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        json_encoders = {PyObjectId: str}

class TicketMessageResponse(TicketMessageInDB):
    pass
