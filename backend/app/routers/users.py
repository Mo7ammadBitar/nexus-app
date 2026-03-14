"""
Users Routes - Profile Management
"""
from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File
from typing import Optional, List
import os
import uuid
import aiofiles

from app.middleware.auth import get_current_user
from app.middleware.rbac import is_premium_user
from app.services.auth_service import AuthService
from app.schemas.user import ProfileUpdateRequest, UserSearchResult
from app.config import get_settings
from app.database import get_users_collection
from app.socket_instance import sio

settings = get_settings()
router = APIRouter(prefix="/users", tags=["Users"])


@router.put("/profile")
async def update_profile(
    request: ProfileUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Update current user's profile.
    Display name, bio, and about_me can be changed by all users.
    accent_color is Premium-only.
    """
    update_data = {}
    
    if request.display_name is not None:
        update_data["display_name"] = request.display_name
    
    if request.bio is not None:
        update_data["bio"] = request.bio
    
    if request.about_me is not None:
        update_data["about_me"] = request.about_me
    
    # Premium-only fields
    if request.accent_color is not None:
        if not is_premium_user(current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Accent color customization is a Premium feature"
            )
        update_data["accent_color"] = request.accent_color

    if request.theme_color is not None:
        if not is_premium_user(current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Client theme customization is a Premium feature"
            )
        update_data["theme_color"] = request.theme_color
    
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )
    
    updated_user = await AuthService.update_user_profile(
        current_user["_id"],
        update_data
    )
    
    return {
        "message": "Profile updated successfully",
        "display_name": updated_user.get("display_name"),
        "bio": updated_user.get("bio"),
        "about_me": updated_user.get("about_me"),
        "accent_color": updated_user.get("accent_color"),
        "theme_color": updated_user.get("theme_color")
    }


@router.post("/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Upload profile avatar.
    Free users: static images only (jpg, png)
    Premium users: can upload animated GIFs
    """
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/webp"]
    is_premium = is_premium_user(current_user)
    
    if is_premium:
        allowed_types.append("image/gif")
    
    if file.content_type not in allowed_types:
        if not is_premium and file.content_type == "image/gif":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Animated avatars are a Premium feature"
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed: {allowed_types}"
        )
    
    # Validate file size (max 5MB)
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File too large. Maximum size: 5MB"
        )
    
    from app.services.cloudinary_service import upload_file
    
    try:
        # Seek to 0 is handled inside upload_file, but just in case we read it earlier we make sure we rewind
        await file.seek(0)
        avatar_url = await upload_file(file, "avatars")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload to Cloudinary: {str(e)}"
        )
    
    # Update user profile
    avatar_type = "animated" if file.content_type == "image/gif" else "static"
    
    await AuthService.update_user_profile(
        current_user["_id"],
        {"avatar_url": avatar_url, "avatar_type": avatar_type}
    )
    
    return {
        "message": "Avatar uploaded successfully",
        "avatar_url": avatar_url,
        "avatar_type": avatar_type
    }


@router.post("/banner")
async def upload_banner(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Upload profile banner.
    Free users: solid images only
    Premium users: can upload gradient/animated banners
    """
    allowed_types = ["image/jpeg", "image/png", "image/webp"]
    is_premium = is_premium_user(current_user)
    
    if is_premium:
        allowed_types.append("image/gif")
    
    if file.content_type not in allowed_types:
        if not is_premium and file.content_type == "image/gif":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Animated banners are a Premium feature"
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed: {allowed_types}"
        )
    
    # Validate file size (max 10MB for banners)
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File too large. Maximum size: 10MB"
        )
    
    from app.services.cloudinary_service import upload_file
    
    try:
        await file.seek(0)
        banner_url = await upload_file(file, "banners")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload to Cloudinary: {str(e)}"
        )
    
    # Determine banner type
    if file.content_type == "image/gif":
        banner_type = "animated"
    else:
        banner_type = "gradient" if is_premium else "solid"
    
    await AuthService.update_user_profile(
        current_user["_id"],
        {"banner_url": banner_url, "banner_type": banner_type}
    )
    
    return {
        "message": "Banner uploaded successfully",
        "banner_url": banner_url,
        "banner_type": banner_type
    }


@router.get("/search")
async def search_users(
    username: str,
    current_user: dict = Depends(get_current_user)
) -> List[UserSearchResult]:
    """
    Search users by username.
    Returns users matching the search query (case-insensitive).
    Used for adding friends.
    """
    if len(username) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Search query must be at least 2 characters"
        )
    
    users = get_users_collection()
    
    # Case-insensitive search
    cursor = users.find({
        "username": {"$regex": f"^{username}", "$options": "i"},
        "is_deleted": {"$ne": True},
        "_id": {"$ne": current_user["_id"]}  # Exclude self
    }).limit(20)
    
    results = []
    async for user in cursor:
        results.append(UserSearchResult(
            id=str(user["_id"]),
            username=user["username"],
            display_name=user.get("display_name"),
            avatar_url=user.get("avatar_url"),
            avatar_type=user.get("avatar_type", "static")
        ))
    
    return results


@router.get("/{user_id}")
async def get_user_profile(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get a user's public profile.
    """
    user = await AuthService.get_user_by_id(user_id)
    
    if not user or user.get("is_deleted"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Return public info only
    return {
        "_id": user["_id"],
        "username": user["username"],
        "display_name": user.get("display_name"),
        "avatar_url": user.get("avatar_url"),
        "avatar_type": user.get("avatar_type"),
        "banner_url": user.get("banner_url"),
        "banner_type": user.get("banner_type"),
        "bio": user.get("bio"),
        "about_me": user.get("about_me"),
        "accent_color": user.get("accent_color"),
        "theme_color": user.get("theme_color"),
        "is_premium": user.get("is_premium", False),
        "premium_since": user.get("premium_since"),
        "status": user.get("status", "online"),
        "is_online": user.get("is_online", False),
        "created_at": user.get("created_at"),
        "equipped_relics": user.get("equipped_relics", {}),
    }


@router.put("/status")
async def update_status(
    status_value: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Update current user's presence status.
    Valid statuses: online, dnd, idle, invisible
    """
    valid_statuses = ["online", "dnd", "idle", "invisible"]
    if status_value not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status. Must be one of: {valid_statuses}"
        )
    
    # When setting status (except invisible), also mark as online
    # This is a fallback if socket connection isn't working
    update_data = {"status": status_value}
    if status_value != "invisible":
        update_data["is_online"] = True
    
    await AuthService.update_user_profile(
        current_user["_id"],
        update_data
    )

    # Broadcast status change
    await sio.emit(
        "presence_update",
        {"user_id": str(current_user["_id"]), "status": status_value},
        namespace="/chat"
    )
    
    return {
        "message": "Status updated",
        "status": status_value
    }

