"""
Role-Based Access Control (RBAC) Middleware
"""
from fastapi import Depends, HTTPException, status
from functools import wraps
from typing import List, Callable

from app.middleware.auth import get_current_user
from app.models.user import UserRole


class RoleChecker:
    """
    Dependency class for checking user roles.
    Usage: Depends(RoleChecker([UserRole.ADMIN, UserRole.SUPER_ADMIN]))
    """
    
    def __init__(self, allowed_roles: List[UserRole]):
        self.allowed_roles = allowed_roles
    
    async def __call__(self, current_user: dict = Depends(get_current_user)) -> dict:
        user_role = current_user.get("role", UserRole.USER)
        
        if user_role not in [role.value for role in self.allowed_roles]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {[r.value for r in self.allowed_roles]}"
            )
        
        return current_user


# Pre-configured role checkers for common use cases

def require_super_admin():
    """Require super_admin role"""
    return RoleChecker([UserRole.SUPER_ADMIN])


def require_admin():
    """Require admin or super_admin role"""
    return RoleChecker([UserRole.ADMIN, UserRole.SUPER_ADMIN])


def require_user():
    """Require any authenticated user"""
    return RoleChecker([UserRole.USER, UserRole.ADMIN, UserRole.SUPER_ADMIN])


# Specific permission checks

async def can_manage_admins(current_user: dict = Depends(get_current_user)) -> dict:
    """Only super_admin can manage admin accounts"""
    if current_user.get("role") != UserRole.SUPER_ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Admin can manage admin accounts"
        )
    return current_user


async def can_manage_users(current_user: dict = Depends(get_current_user)) -> dict:
    """Admin and super_admin can manage user accounts"""
    if current_user.get("role") not in [UserRole.ADMIN.value, UserRole.SUPER_ADMIN.value]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Admin or Super Admin can manage users"
        )
    return current_user


async def can_manage_servers(current_user: dict = Depends(get_current_user)) -> dict:
    """Admin and super_admin can manage servers"""
    if current_user.get("role") not in [UserRole.ADMIN.value, UserRole.SUPER_ADMIN.value]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Admin or Super Admin can manage servers"
        )
    return current_user


def is_premium_user(user: dict) -> bool:
    """Check if user has premium features"""
    # Super Admin and Admin always have premium
    if user.get("role") in [UserRole.SUPER_ADMIN.value, UserRole.ADMIN.value]:
        return True
    return user.get("is_premium", False)
