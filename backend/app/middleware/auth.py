"""
Authentication Middleware - JWT Verification & Current User
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from datetime import datetime
from typing import Optional
from bson import ObjectId

from app.database import get_users_collection
from app.utils.security import decode_access_token
from app.models.user import UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    """
    Validate JWT token and return current user.
    Raises HTTPException if token is invalid or user not found.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # Decode token
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
    
    user_id: str = payload.get("sub")
    if user_id is None:
        raise credentials_exception
    
    # Fetch user from database
    users = get_users_collection()
    user = await users.find_one({"_id": ObjectId(user_id)})
    
    if user is None:
        raise credentials_exception
    
    # Check if user is deleted
    if user.get("is_deleted", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account has been deleted"
        )
    
    # Check if user is banned
    if user.get("is_banned", False):
        ban_expires = user.get("ban_expires_at")
        ban_reason = user.get("ban_reason", "No reason provided")
        
        # Check if ban has expired
        if ban_expires and ban_expires < datetime.utcnow():
            # Lift the ban
            await users.update_one(
                {"_id": ObjectId(user_id)},
                {"$set": {"is_banned": False, "ban_reason": None, "ban_expires_at": None}}
            )
        else:
            # Ban is still active
            if ban_expires:
                detail = f"Account banned until {ban_expires.isoformat()}. Reason: {ban_reason}"
            else:
                detail = f"Account permanently banned. Reason: {ban_reason}"
            
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=detail
            )
    
    # Check if premium has expired (lazy evaluation)
    if user.get("is_premium", False):
        premium_expires = user.get("premium_expires_at")
        if premium_expires and premium_expires < datetime.utcnow():
            # Revoke premium status
            await users.update_one(
                {"_id": ObjectId(user_id)},
                {"$set": {
                    "is_premium": False,
                    "premium_expires_at": None,
                    "premium_plan": None,
                }}
            )
            user["is_premium"] = False
            user["premium_expires_at"] = None
            user["premium_plan"] = None
    
    # Convert ObjectId to string for JSON serialization
    user["_id"] = str(user["_id"])
    
    return user


async def get_current_active_user(current_user: dict = Depends(get_current_user)) -> dict:
    """Get current active (non-banned, non-deleted) user"""
    return current_user


def get_optional_user(token: Optional[str] = Depends(oauth2_scheme)) -> Optional[dict]:
    """Get current user if token provided, otherwise None"""
    if not token:
        return None
    try:
        return get_current_user(token)
    except HTTPException:
        return None
