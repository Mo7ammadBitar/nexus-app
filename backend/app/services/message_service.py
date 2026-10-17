"""
Message Service - Channel Messages Business Logic
"""
from datetime import datetime
from typing import Optional, List
from bson import ObjectId

from app.database import get_messages_collection, get_users_collection


class MessageService:
    """Channel message business logic"""
    
    @staticmethod
    async def create_message(channel_id: str, user_id: str, content: str, attachments: List[dict] = None, reply_to_id: str = None) -> dict:
        """Create a new message in a channel"""
        messages = get_messages_collection()
        users = get_users_collection()
        
        message_doc = {
            "channel_id": channel_id,
            "user_id": user_id,
            "content": content,
            "attachments": attachments or [],
            "timestamp": datetime.utcnow(),
        }
        
        # Handle reply
        if reply_to_id:
            replied_msg = await messages.find_one({"_id": ObjectId(reply_to_id)})
            if replied_msg:
                # Get replied message author info
                replied_user = await users.find_one({"_id": ObjectId(replied_msg["user_id"])})
                message_doc["reply_to"] = {
                    "message_id": reply_to_id,
                    "content": replied_msg.get("content", "")[:100],  # Truncate to 100 chars
                    "username": replied_user.get("username", "Unknown") if replied_user else "Unknown",
                    "user_id": replied_msg["user_id"]
                }
        
        result = await messages.insert_one(message_doc)
        message_doc["_id"] = str(result.inserted_id)
        return message_doc
    
    @staticmethod
    async def get_channel_messages(channel_id: str, limit: int = 50, before_id: str = None) -> List[dict]:
        """
        Get messages from a channel.
        Returns last 50 messages by default with pagination support.
        """
        messages = get_messages_collection()
        users = get_users_collection()
        
        query = {"channel_id": channel_id}
        
        if before_id:
            query["_id"] = {"$lt": ObjectId(before_id)}
        
        cursor = messages.find(query).sort("timestamp", -1).limit(limit)
        
        # Build user cache
        user_cache = {}
        
        result = []
        async for message in cursor:
            message["_id"] = str(message["_id"])
            
            # Get user info (with caching)
            user_id = message["user_id"]
            if user_id not in user_cache:
                user = await users.find_one({"_id": ObjectId(user_id)})
                if user:
                    user_cache[user_id] = {
                        "username": user["username"],
                        "display_name": user.get("display_name"),
                        "avatar_url": user.get("avatar_url")
                    }
            
            if user_id in user_cache:
                message.update(user_cache[user_id])
            
            result.append(message)
        
        # Reverse for chronological order
        result.reverse()
        return result
    
    @staticmethod
    async def delete_message(message_id: str) -> bool:
        """Delete a message"""
        messages = get_messages_collection()
        result = await messages.delete_one({"_id": ObjectId(message_id)})
        return result.deleted_count > 0
    
    @staticmethod
    async def get_message_by_id(message_id: str) -> Optional[dict]:
        """Get message by ID"""
        messages = get_messages_collection()
        message = await messages.find_one({"_id": ObjectId(message_id)})
        if message:
            message["_id"] = str(message["_id"])
        return message
    
    @staticmethod
    async def update_message(message_id: str, content: str) -> Optional[dict]:
        """Update a message's content"""
        messages = get_messages_collection()
        
        result = await messages.find_one_and_update(
            {"_id": ObjectId(message_id)},
            {
                "$set": {
                    "content": content,
                    "is_edited": True,
                    "edited_at": datetime.utcnow()
                }
            },
            return_document=True
        )
        
        if result:
            result["_id"] = str(result["_id"])
        return result

    @staticmethod
    async def add_reaction(message_id: str, user_id: str, emoji: str) -> Optional[dict]:
        """Add a reaction to a message"""
        messages = get_messages_collection()
        
        # Use $addToSet to avoid duplicates
        result = await messages.find_one_and_update(
            {"_id": ObjectId(message_id)},
            {"$addToSet": {f"reactions.{emoji}": user_id}},
            return_document=True
        )
        
        if result:
            result["_id"] = str(result["_id"])
        return result

    @staticmethod
    async def remove_reaction(message_id: str, user_id: str, emoji: str) -> Optional[dict]:
        """Remove a reaction from a message"""
        messages = get_messages_collection()
        
        result = await messages.find_one_and_update(
            {"_id": ObjectId(message_id)},
            {"$pull": {f"reactions.{emoji}": user_id}},
            return_document=True
        )
        
        if result:
            result["_id"] = str(result["_id"])
            # Clean up empty emoji arrays
            if result.get("reactions", {}).get(emoji) == []:
                await messages.update_one(
                    {"_id": ObjectId(message_id)},
                    {"$unset": {f"reactions.{emoji}": ""}}
                )
                if "reactions" in result and emoji in result["reactions"]:
                    del result["reactions"][emoji]
        return result

    @staticmethod
    async def forward_message(
        source_message_id: str,
        target_channel_id: str,
        user_id: str,
        source_server_name: str = None
    ) -> dict:
        """Forward a message to a channel"""
        messages = get_messages_collection()
        users = get_users_collection()
        
        # Get source message
        source_msg = await messages.find_one({"_id": ObjectId(source_message_id)})
        if not source_msg:
            return None
        
        # Create forwarded message
        message_doc = {
            "channel_id": target_channel_id,
            "user_id": user_id,
            "content": source_msg.get("content", ""),
            "attachments": source_msg.get("attachments", []),
            "timestamp": datetime.utcnow(),
            "is_forwarded": True,
            "forward_origin_id": source_message_id,
            "forward_server_name": source_server_name,
        }
        
        result = await messages.insert_one(message_doc)
        message_doc["_id"] = str(result.inserted_id)
        
        # Add user info
        user = await users.find_one({"_id": ObjectId(user_id)})
        if user:
            message_doc["username"] = user.get("username")
            message_doc["display_name"] = user.get("display_name")
            message_doc["avatar_url"] = user.get("avatar_url")
        
        return message_doc

    @staticmethod
    async def get_message_for_preview(message_id: str) -> Optional[dict]:
        """Get message with minimal info for preview"""
        messages = get_messages_collection()
        users = get_users_collection()
        
        message = await messages.find_one({"_id": ObjectId(message_id)})
        if not message:
            return None
        
        # Get author info
        author = await users.find_one({"_id": ObjectId(message["user_id"])})
        
        return {
            "content_snippet": message.get("content", "")[:100],
            "author_username": author.get("username", "Unknown") if author else "Unknown",
            "timestamp": message.get("timestamp")
        }

    @staticmethod
    async def pin_message(message_id: str) -> Optional[dict]:
        """Pin a message"""
        messages = get_messages_collection()
        
        result = await messages.find_one_and_update(
            {"_id": ObjectId(message_id)},
            {"$set": {"is_pinned": True}},
            return_document=True
        )
        
        if result:
            result["_id"] = str(result["_id"])
        return result

    @staticmethod
    async def unpin_message(message_id: str) -> Optional[dict]:
        """Unpin a message"""
        messages = get_messages_collection()
        
        result = await messages.find_one_and_update(
            {"_id": ObjectId(message_id)},
            {"$set": {"is_pinned": False}},
            return_document=True
        )
        
        if result:
            result["_id"] = str(result["_id"])
        return result

    @staticmethod
    async def get_pinned_messages(channel_id: str) -> List[dict]:
        """Get pinned messages for a channel"""
        messages = get_messages_collection()
        users = get_users_collection()
        
        cursor = messages.find({"channel_id": channel_id, "is_pinned": True}).sort("timestamp", 1)
        
        user_cache = {}
        result = []
        
        async for message in cursor:
            message["_id"] = str(message["_id"])
            
            # Get user info (with caching)
            user_id = message["user_id"]
            if user_id not in user_cache:
                user = await users.find_one({"_id": ObjectId(user_id)})
                if user:
                    user_cache[user_id] = {
                        "username": user["username"],
                        "display_name": user.get("display_name"),
                        "avatar_url": user.get("avatar_url")
                    }
            
            if user_id in user_cache:
                message.update(user_cache[user_id])
            
            result.append(message)
            
        return result

