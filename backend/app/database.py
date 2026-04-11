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
        if cls.client is not None:
            return
            
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

        # Support Tickets collection indexes
        await cls.db.tickets.create_index("user_id")
        await cls.db.tickets.create_index("status")
        await cls.db.ticket_messages.create_index("ticket_id")

        # Quest Progress collection indexes
        await cls.db.user_quest_progress.create_index(
            [("user_id", 1), ("quest_id", 1)], unique=True
        )

        # Game Challenges collection indexes
        await cls.db.game_challenges.create_index(
            [("opponent_id", 1), ("status", 1)]
        )
        await cls.db.game_challenges.create_index(
            [("challenger_id", 1), ("status", 1)]
        )
        await cls.db.game_challenges.create_index(
            "expires_at",
            expireAfterSeconds=300  # Auto-delete 5 min after expiry
        )
        
        print("✅ Database indexes created")


# Database check helper
def _check_db():
    if Database.db is None:
        raise RuntimeError("Database not initialized. Call Database.connect() first.")

def get_database() -> AsyncIOMotorDatabase:
    """Get database instance for dependency injection"""
    _check_db()
    return Database.db


# Collection accessors
def get_users_collection():
    _check_db()
    return Database.db.users


def get_servers_collection():
    _check_db()
    return Database.db.servers


def get_members_collection():
    _check_db()
    return Database.db.members


def get_channels_collection():
    _check_db()
    return Database.db.channels


def get_messages_collection():
    _check_db()
    return Database.db.messages


def get_direct_messages_collection():
    _check_db()
    return Database.db.direct_messages


def get_friends_collection():
    _check_db()
    return Database.db.friends


def get_starred_messages_collection():
    _check_db()
    return Database.db.starred_messages


def get_tickets_collection():
    _check_db()
    return Database.db.tickets


def get_ticket_messages_collection():
    _check_db()
    return Database.db.ticket_messages


def get_quest_progress_collection():
    _check_db()
    return Database.db.user_quest_progress


def get_game_challenges_collection():
    _check_db()
    return Database.db.game_challenges
