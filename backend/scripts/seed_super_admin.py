"""
Super Admin Seeding Script
Creates the initial super admin account on first run.
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime

from app.config import get_settings
from app.utils.security import hash_password
from app.models.user import UserRole, AvatarType, BannerType

settings = get_settings()


async def seed_super_admin():
    """Create super admin account if it doesn't exist"""
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.database_name]
    users = db.users
    
    # Check if super admin already exists
    existing = await users.find_one({"email": settings.super_admin_email})
    
    if existing:
        print(f"✅ Super Admin already exists: {settings.super_admin_username}")
        client.close()
        return
    
    # Also check if username is taken
    existing_username = await users.find_one({"username": settings.super_admin_username})
    if existing_username:
        print(f"⚠️ Username '{settings.super_admin_username}' already taken by another account")
        client.close()
        return
    
    # Create super admin document
    super_admin = {
        "username": settings.super_admin_username,
        "email": settings.super_admin_email,
        "password_hash": hash_password(settings.super_admin_password),
        "display_name": settings.super_admin_username,
        "role": UserRole.SUPER_ADMIN.value,
        
        # Profile
        "avatar_url": None,
        "avatar_type": AvatarType.STATIC.value,
        "banner_url": None,
        "banner_type": BannerType.SOLID.value,
        "bio": "System Administrator",
        
        # Premium (always enabled for super admin)
        "is_premium": True,
        
        # Ban system (super admin cannot be banned)
        "is_banned": False,
        "ban_reason": None,
        "ban_expires_at": None,
        
        # Soft delete
        "is_deleted": False,
        
        # Metadata
        "created_by": None,  # Self-created
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    
    result = await users.insert_one(super_admin)
    
    print("=" * 50)
    print("🔐 SUPER ADMIN ACCOUNT CREATED")
    print("=" * 50)
    print(f"   Email:    {settings.super_admin_email}")
    print(f"   Username: {settings.super_admin_username}")
    print(f"   Password: {settings.super_admin_password}")
    print(f"   ID:       {result.inserted_id}")
    print("=" * 50)
    print("⚠️  IMPORTANT: Change the password in production!")
    print("=" * 50)
    
    client.close()


if __name__ == "__main__":
    asyncio.run(seed_super_admin())
