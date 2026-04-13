from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class AuditLog(BaseModel):
    """Audit Log entry for server actions (e.g., Sentinel)"""
    id: Optional[str] = Field(None, alias="_id")
    server_id: str
    action: str
    user_id: str
    reason: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        populate_by_name = True
