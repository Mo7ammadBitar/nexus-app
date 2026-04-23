"""
Authentication Service - Business Logic
"""
from datetime import datetime, timedelta
from typing import Optional
from bson import ObjectId

from app.database import get_users_collection
from app.models.user import UserCreate, UserRole, AvatarType, BannerType
from app.utils.security import hash_password, verify_password, create_access_token


class AuthService:
    """Authentication business logic"""
    
    @staticmethod
    async def create_user(user_data: UserCreate, role: UserRole = UserRole.USER, created_by: Optional[str] = None) -> dict:
        """
        Create a new user account.
        Returns the created user document.
        """
        users = get_users_collection()
        
        # Check if email already exists
        existing = await users.find_one({"email": user_data.email})
        if existing:
            raise ValueError("Email already registered")
        
        # Check if username already exists
        existing = await users.find_one({"username": user_data.username})
        if existing:
            raise ValueError("Username already taken")
        
        # Determine if premium (admin/super_admin always premium)
        is_premium = role in [UserRole.ADMIN, UserRole.SUPER_ADMIN]
        
        # Create user document
        user_doc = {
            "username": user_data.username,
            "email": user_data.email,
            "password_hash": hash_password(user_data.password),
            "display_name": user_data.username,  # Default display name = username
            "role": role.value,
            
            # Profile defaults
            "avatar_url": None,
            "avatar_type": AvatarType.STATIC.value,
            "banner_url": None,
            "banner_type": BannerType.SOLID.value,
            "bio": None,
            
            # Premium
            "is_premium": is_premium,
            
            # Ban system
            "is_banned": False,
            "ban_reason": None,
            "ban_expires_at": None,
            
            # Soft delete
            "is_deleted": False,
            
            # Email Verification
            "is_email_verified": False,
            "email_verification_token": None,
            "email_verification_expires": None,
            
            # Metadata
            "created_by": created_by,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
        
        result = await users.insert_one(user_doc)
        user_doc["_id"] = str(result.inserted_id)
        
        return user_doc
    
    @staticmethod
    async def authenticate_user(email: str, password: str) -> tuple[Optional[dict], Optional[str]]:
        """
        Authenticate user with email and password.
        Returns (user, error_code).
        error_code can be "USER_NOT_FOUND", "INVALID_PASSWORD", or None.
        """
        users = get_users_collection()
        user = await users.find_one({"email": email})
        
        if not user:
            return None, "USER_NOT_FOUND"
        
        if not verify_password(password, user["password_hash"]):
            return None, "INVALID_PASSWORD"
        
        return user, None
    
    @staticmethod
    def create_user_token(user: dict) -> str:
        """Create JWT token for user"""
        user_id = str(user["_id"]) if isinstance(user["_id"], ObjectId) else user["_id"]
        
        token_data = {
            "sub": user_id,
            "role": user.get("role", UserRole.USER.value),
            "username": user.get("username"),
        }
        
        return create_access_token(token_data)
    
    @staticmethod
    async def get_user_by_id(user_id: str) -> Optional[dict]:
        """Get user by ID"""
        users = get_users_collection()
        user = await users.find_one({"_id": ObjectId(user_id)})
        if user:
            user["_id"] = str(user["_id"])
        return user
    
    @staticmethod
    async def get_user_by_email(email: str) -> Optional[dict]:
        """Get user by email"""
        users = get_users_collection()
        user = await users.find_one({"email": email})
        if user:
            user["_id"] = str(user["_id"])
        return user
    
    @staticmethod
    async def get_user_by_username(username: str) -> Optional[dict]:
        """Get user by username"""
        users = get_users_collection()
        user = await users.find_one({"username": username})
        if user:
            user["_id"] = str(user["_id"])
        return user
    
    @staticmethod
    async def update_user_profile(user_id: str, update_data: dict) -> Optional[dict]:
        """Update user profile"""
        users = get_users_collection()
        
        update_data["updated_at"] = datetime.utcnow()
        
        result = await users.find_one_and_update(
            {"_id": ObjectId(user_id)},
            {"$set": update_data},
            return_document=True
        )
        
        if result:
            result["_id"] = str(result["_id"])
        
        return result
    
    @staticmethod
    async def ban_user(user_id: str, reason: str, duration_days: Optional[int] = None) -> dict:
        """
        Ban a user.
        duration_days: None = permanent ban
        """
        users = get_users_collection()
        
        ban_expires = None
        if duration_days:
            ban_expires = datetime.utcnow() + timedelta(days=duration_days)
        
        update_data = {
            "is_banned": True,
            "ban_reason": reason,
            "ban_expires_at": ban_expires,
            "updated_at": datetime.utcnow(),
        }
        
        result = await users.find_one_and_update(
            {"_id": ObjectId(user_id)},
            {"$set": update_data},
            return_document=True
        )
        
        if result:
            result["_id"] = str(result["_id"])
        
        return result
    
    @staticmethod
    async def unban_user(user_id: str) -> dict:
        """Remove ban from user"""
        users = get_users_collection()
        
        update_data = {
            "is_banned": False,
            "ban_reason": None,
            "ban_expires_at": None,
            "updated_at": datetime.utcnow(),
        }
        
        result = await users.find_one_and_update(
            {"_id": ObjectId(user_id)},
            {"$set": update_data},
            return_document=True
        )
        
        if result:
            result["_id"] = str(result["_id"])
        
        return result
    
    @staticmethod
    async def soft_delete_user(user_id: str) -> dict:
        """Soft delete user (mark as deleted)"""
        users = get_users_collection()
        
        update_data = {
            "is_deleted": True,
            "updated_at": datetime.utcnow(),
        }
        
        result = await users.find_one_and_update(
            {"_id": ObjectId(user_id)},
            {"$set": update_data},
            return_document=True
        )
        
        if result:
            result["_id"] = str(result["_id"])
        
        return result
    
    @staticmethod
    async def hard_delete_user(user_id: str) -> bool:
        """Permanently delete user"""
        users = get_users_collection()
        result = await users.delete_one({"_id": ObjectId(user_id)})
        return result.deleted_count > 0
    
    @staticmethod
    async def update_password(email: str, new_password: str) -> bool:
        """Update user password by email"""
        users = get_users_collection()
        
        result = await users.update_one(
            {"email": email.lower()},
            {
                "$set": {
                    "password_hash": hash_password(new_password),
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        return result.modified_count > 0
