"""
User Management Schemas
"""
from pydantic import BaseModel, Field
from typing import Optional


class ProfileUpdateRequest(BaseModel):
    """Update user profile"""
    display_name: Optional[str] = Field(None, max_length=32)
    bio: Optional[str] = Field(None, max_length=500)
    accent_color: Optional[str] = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$')  # Premium only
    theme_color: Optional[str] = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$')    # Client theme color
    about_me: Optional[str] = Field(None, max_length=300)


class UserSearchResult(BaseModel):
    """User search result (public info only)"""
    id: str
    username: str
    display_name: Optional[str]
    avatar_url: Optional[str]
    avatar_type: str

