"""
MongoDB Database Connection using Motor (Async Driver)
"""
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from typing import Optional
from app.config import get_settings

settings = get_settings()


class Database:
    """MongoDB async database connection manager"""
    
    client: Optional[AsyncIOMotorClient] = None
    db: Optional[AsyncIOMotorDatabase] = None
    
    @classmethod
    async def connect(cls):
        """Connect to MongoDB"""
        cls.client = AsyncIOMotorClient(settings.mongodb_url)
        cls.db = cls.client[settings.database_name]
        
        # Create indexes
        await cls._create_indexes()
        
        print(f"✅ Connected to MongoDB: {settings.database_name}")
    
    @classmethod
    async def disconnect(cls):
        """Disconnect from MongoDB"""
        if cls.client:
            cls.client.close()
            print("❌ Disconnected from MongoDB")
    
    @classmethod
    async def _create_indexes(cls):
        """Create database indexes"""
        # Users collection indexes
        await cls.db.users.create_index("email", unique=True)
        await cls.db.users.create_index("username", unique=True)
        
        # Servers collection indexes
        await cls.db.servers.create_index("invite_code", unique=True)
        
        # Members collection indexes (compound index)
        await cls.db.members.create_index([("server_id", 1), ("user_id", 1)], unique=True)
        
        # Channels collection indexes
        await cls.db.channels.create_index([("server_id", 1), ("type", 1)])
        
        # Messages TTL index (auto-delete after 30 days)
        await cls.db.messages.create_index(
            "timestamp", 
            expireAfterSeconds=2592000  # 30 days
        )
        await cls.db.messages.create_index("channel_id")
        
        # Direct Messages TTL index
        await cls.db.direct_messages.create_index(
            "timestamp",
            expireAfterSeconds=2592000
        )
        await cls.db.direct_messages.create_index([("sender_id", 1), ("receiver_id", 1)])
        
        # Friends collection indexes
        await cls.db.friends.create_index([("requester_id", 1), ("receiver_id", 1)], unique=True)
        
        # Starred messages collection indexes
        await cls.db.starred_messages.create_index([("user_id", 1), ("message_id", 1)], unique=True)
        await cls.db.starred_messages.create_index("user_id")
        
        print("✅ Database indexes created")


def get_database() -> AsyncIOMotorDatabase:
    """Get database instance for dependency injection"""
    return Database.db


# Collection accessors
def get_users_collection():
    return Database.db.users


def get_servers_collection():
    return Database.db.servers


def get_members_collection():
    return Database.db.members


def get_channels_collection():
    return Database.db.channels


def get_messages_collection():
    return Database.db.messages


def get_direct_messages_collection():
    return Database.db.direct_messages


def get_friends_collection():
    return Database.db.friends


def get_starred_messages_collection():
    return Database.db.starred_messages
