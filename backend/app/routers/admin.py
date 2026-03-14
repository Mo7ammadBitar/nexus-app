"""
Admin Routes - User, Admin, and Server Management
"""
from fastapi import APIRouter, HTTPException, status, Depends, Query
from typing import Optional, List
from bson import ObjectId

from app.middleware.auth import get_current_user
from app.middleware.rbac import can_manage_admins, can_manage_users, can_manage_servers
from app.services.auth_service import AuthService
from app.services.server_service import ServerService, MemberService
from app.schemas.admin import (
    CreateAdminRequest,
    CreateUserRequest,
    BanUserRequest,
    BanServerRequest,
    UpdateUserRequest,
    UpdateAdminRequest,
    UpdateServerAdminRequest,
)
from app.models.user import UserCreate, UserRole
from app.database import get_users_collection, get_servers_collection

router = APIRouter(prefix="/admin", tags=["Admin"])


# ============ Admin Account Management (Super Admin Only) ============

@router.post("/create-admin", status_code=status.HTTP_201_CREATED)
async def create_admin(
    request: CreateAdminRequest,
    current_user: dict = Depends(can_manage_admins)
):
    """
    Create a new admin account.
    Super Admin only.
    """
    try:
        user_data = UserCreate(
            username=request.username,
            email=request.email,
            password=request.password
        )
        
        admin = await AuthService.create_user(
            user_data,
            role=UserRole.ADMIN,
            created_by=current_user["_id"]
        )
        
        return {
            "message": "Admin account created successfully",
            "admin": {
                "id": admin["_id"],
                "username": admin["username"],
                "email": admin["email"],
                "role": admin["role"]
            }
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/admins")
async def list_admins(current_user: dict = Depends(can_manage_admins)):
    """
    List all admin accounts.
    Super Admin only.
    """
    users = get_users_collection()
    
    cursor = users.find({
        "role": UserRole.ADMIN.value,
        "is_deleted": {"$ne": True}
    })
    
    result = []
    async for admin in cursor:
        result.append({
            "id": str(admin["_id"]),
            "username": admin["username"],
            "email": admin["email"],
            "display_name": admin.get("display_name"),
            "is_banned": admin.get("is_banned", False),
            "created_at": admin.get("created_at")
        })
    
    return {"admins": result}


@router.delete("/admins/{admin_id}")
async def delete_admin(
    admin_id: str,
    current_user: dict = Depends(can_manage_admins)
):
    """
    Delete an admin account.
    Super Admin only.
    """
    # Verify target is an admin
    admin = await AuthService.get_user_by_id(admin_id)
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Admin not found"
        )
    
    if admin["role"] != UserRole.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target is not an admin"
        )
    
    await AuthService.hard_delete_user(admin_id)
    return {"message": "Admin account deleted"}


@router.put("/admins/{admin_id}")
async def update_admin(
    admin_id: str,
    request: UpdateAdminRequest,
    current_user: dict = Depends(can_manage_admins)
):
    """
    Update admin account information.
    Super Admin only.
    """
    admin = await AuthService.get_user_by_id(admin_id)
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Admin not found"
        )
    
    if admin["role"] != UserRole.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target is not an admin"
        )
    
    update_data = {}
    if request.display_name is not None:
        update_data["display_name"] = request.display_name
    
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )
    
    updated = await AuthService.update_user_profile(admin_id, update_data)
    return {"message": "Admin updated", "admin": updated}


# ============ User Management (Admin + Super Admin) ============

@router.post("/create-user", status_code=status.HTTP_201_CREATED)
async def create_user(
    request: CreateUserRequest,
    current_user: dict = Depends(can_manage_users)
):
    """
    Create a new user account.
    Admin and Super Admin.
    """
    try:
        user_data = UserCreate(
            username=request.username,
            email=request.email,
            password=request.password
        )
        
        user = await AuthService.create_user(
            user_data,
            role=UserRole.USER,
            created_by=current_user["_id"]
        )
        
        return {
            "message": "User account created successfully",
            "user": {
                "id": user["_id"],
                "username": user["username"],
                "email": user["email"],
                "role": user["role"]
            }
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/users")
async def list_users(
    role: Optional[str] = Query(None),
    is_banned: Optional[bool] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    skip: int = Query(0, ge=0),
    current_user: dict = Depends(can_manage_users)
):
    """
    List all users with optional filters.
    Admin and Super Admin.
    Admin can only see regular users (role="user").
    Super Admin can see all users.
    """
    users = get_users_collection()
    
    query = {"is_deleted": {"$ne": True}}
    
    # Admin (not super admin) can only see regular users
    if current_user["role"] != UserRole.SUPER_ADMIN.value:
        query["role"] = UserRole.USER.value
    
    # Apply role filter if provided (only super admin can filter by role)
    if role and current_user["role"] == UserRole.SUPER_ADMIN.value:
        query["role"] = role
    
    if is_banned is not None:
        query["is_banned"] = is_banned
    
    cursor = users.find(query).skip(skip).limit(limit).sort("created_at", -1)
    
    result = []
    async for user in cursor:
        result.append({
            "id": str(user["_id"]),
            "username": user["username"],
            "email": user["email"],
            "display_name": user.get("display_name"),
            "role": user["role"],
            "is_premium": user.get("is_premium", False),
            "is_banned": user.get("is_banned", False),
            "ban_reason": user.get("ban_reason"),
            "ban_expires_at": user.get("ban_expires_at"),
            "created_at": user.get("created_at")
        })
    
    # Get total count
    total = await users.count_documents(query)
    
    return {"users": result, "total": total, "limit": limit, "skip": skip}


@router.put("/users/{user_id}")
async def update_user(
    user_id: str,
    request: UpdateUserRequest,
    current_user: dict = Depends(can_manage_users)
):
    """
    Update user details.
    Admin and Super Admin.
    """
    user = await AuthService.get_user_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Prevent modifying super admin
    if user["role"] == UserRole.SUPER_ADMIN.value and current_user["role"] != UserRole.SUPER_ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot modify Super Admin"
        )
    
    # Prevent admin modifying another admin (unless super admin)
    if user["role"] == UserRole.ADMIN.value and current_user["role"] != UserRole.SUPER_ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Admin can modify admin accounts"
        )
    
    # Prevent disabling premium for Admin/Super Admin
    if user["role"] in [UserRole.ADMIN.value, UserRole.SUPER_ADMIN.value]:
        if request.is_premium is not None and request.is_premium is False:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot disable premium for Admin or Super Admin accounts"
            )
    
    update_data = {}
    if request.display_name is not None:
        update_data["display_name"] = request.display_name
    if request.is_premium is not None:
        # Only allow enabling premium for regular users
        if user["role"] == UserRole.USER.value:
            update_data["is_premium"] = request.is_premium
    
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )
    
    updated = await AuthService.update_user_profile(user_id, update_data)
    return {"message": "User updated", "user": updated}


@router.put("/users/{user_id}/ban")
async def ban_user(
    user_id: str,
    request: BanUserRequest,
    current_user: dict = Depends(can_manage_users)
):
    """
    Ban a user.
    Admin and Super Admin.
    """
    user = await AuthService.get_user_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Prevent banning super admin
    if user["role"] == UserRole.SUPER_ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot ban Super Admin"
        )
    
    # Prevent admin banning another admin
    if user["role"] == UserRole.ADMIN.value and current_user["role"] != UserRole.SUPER_ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Admin can ban admin accounts"
        )
    
    banned = await AuthService.ban_user(user_id, request.reason, request.duration_days)
    
    return {
        "message": "User banned",
        "user_id": user_id,
        "reason": request.reason,
        "duration_days": request.duration_days,
        "expires_at": banned.get("ban_expires_at")
    }


@router.put("/users/{user_id}/unban")
async def unban_user(
    user_id: str,
    current_user: dict = Depends(can_manage_users)
):
    """
    Unban a user.
    Admin and Super Admin.
    """
    unbanned = await AuthService.unban_user(user_id)
    if not unbanned:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return {"message": "User unbanned", "user_id": user_id}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    permanent: bool = Query(False),
    current_user: dict = Depends(can_manage_users)
):
    """
    Delete a user (soft or permanent).
    Admin and Super Admin.
    """
    user = await AuthService.get_user_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Prevent deleting super admin
    if user["role"] == UserRole.SUPER_ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot delete Super Admin"
        )
    
    # Prevent admin deleting another admin
    if user["role"] == UserRole.ADMIN.value and current_user["role"] != UserRole.SUPER_ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Admin can delete admin accounts"
        )
    
    if permanent:
        await AuthService.hard_delete_user(user_id)
        return {"message": "User permanently deleted", "user_id": user_id}
    else:
        await AuthService.soft_delete_user(user_id)
        return {"message": "User deleted (soft)", "user_id": user_id}


# ============ Server Management (Admin + Super Admin) ============

@router.get("/servers")
async def list_servers(
    is_banned: Optional[bool] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    skip: int = Query(0, ge=0),
    current_user: dict = Depends(can_manage_servers)
):
    """
    List all servers with optional filters.
    Admin and Super Admin.
    """
    servers = get_servers_collection()
    users = get_users_collection()
    
    query = {"is_deleted": {"$ne": True}}
    if is_banned is not None:
        query["is_banned"] = is_banned
    
    cursor = servers.find(query).skip(skip).limit(limit).sort("created_at", -1)
    
    result = []
    async for server in cursor:
        # Get owner info
        owner = await users.find_one({"_id": ObjectId(server["owner_id"])})
        owner_username = owner["username"] if owner else "Unknown"
        
        # Get member count
        member_count = await MemberService.get_server_members(str(server["_id"]))
        
        result.append({
            "id": str(server["_id"]),
            "name": server["name"],
            "owner_id": server["owner_id"],
            "owner_username": owner_username,
            "invite_code": server["invite_code"],
            "member_count": len(member_count),
            "is_banned": server.get("is_banned", False),
            "ban_reason": server.get("ban_reason"),
            "ban_expires_at": server.get("ban_expires_at"),
            "created_at": server.get("created_at")
        })
    
    total = await servers.count_documents(query)
    
    return {"servers": result, "total": total, "limit": limit, "skip": skip}


@router.put("/servers/{server_id}")
async def update_server_admin(
    server_id: str,
    request: UpdateServerAdminRequest,
    current_user: dict = Depends(can_manage_servers)
):
    """
    Update server information.
    Admin and Super Admin.
    """
    server = await ServerService.get_server_by_id(server_id)
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Server not found"
        )
    
    update_data = {}
    if request.name:
        update_data["name"] = request.name
    
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )
    
    updated = await ServerService.update_server(server_id, update_data)
    return {"message": "Server updated", "server": updated}


@router.put("/servers/{server_id}/ban")
async def ban_server(
    server_id: str,
    request: BanServerRequest,
    current_user: dict = Depends(can_manage_servers)
):
    """
    Ban a server.
    Admin and Super Admin.
    """
    server = await ServerService.get_server_by_id(server_id)
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Server not found"
        )
    
    banned = await ServerService.ban_server(server_id, request.reason, request.duration_days)
    
    return {
        "message": "Server banned",
        "server_id": server_id,
        "reason": request.reason,
        "duration_days": request.duration_days,
        "expires_at": banned.get("ban_expires_at")
    }


@router.put("/servers/{server_id}/unban")
async def unban_server(
    server_id: str,
    current_user: dict = Depends(can_manage_servers)
):
    """
    Unban a server.
    Admin and Super Admin.
    """
    servers = get_servers_collection()
    
    result = await servers.find_one_and_update(
        {"_id": ObjectId(server_id)},
        {"$set": {
            "is_banned": False,
            "ban_reason": None,
            "ban_expires_at": None
        }},
        return_document=True
    )
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Server not found"
        )
    
    return {"message": "Server unbanned", "server_id": server_id}


@router.delete("/servers/{server_id}")
async def delete_server_admin(
    server_id: str,
    permanent: bool = Query(False),
    current_user: dict = Depends(can_manage_servers)
):
    """
    Delete a server (soft or permanent).
    Admin and Super Admin.
    """
    server = await ServerService.get_server_by_id(server_id)
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Server not found"
        )
    
    if permanent:
        await ServerService.hard_delete_server(server_id)
        return {"message": "Server permanently deleted", "server_id": server_id}
    else:
        await ServerService.delete_server(server_id)
        return {"message": "Server deleted (soft)", "server_id": server_id}
