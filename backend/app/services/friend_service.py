"""
Friends and Direct Messages Service - Business Logic
"""
from datetime import datetime
from typing import Optional, List
from bson import ObjectId

from app.database import (
    get_friends_collection,
    get_direct_messages_collection,
    get_users_collection,
)
from app.models.friend import FriendStatus


class FriendService:
    """Friend request and management business logic"""
    
    @staticmethod
    async def send_friend_request(requester_id: str, receiver_id: str) -> dict:
        """Send a friend request"""
        friends = get_friends_collection()
        
        if requester_id == receiver_id:
            raise ValueError("Cannot send friend request to yourself")
        
        # Check if request already exists (in either direction)
        existing = await friends.find_one({
            "$or": [
                {"requester_id": requester_id, "receiver_id": receiver_id},
                {"requester_id": receiver_id, "receiver_id": requester_id}
            ]
        })
        
        if existing:
            if existing["status"] == FriendStatus.ACCEPTED.value:
                raise ValueError("Already friends")
            elif existing["status"] == FriendStatus.PENDING.value:
                raise ValueError("Friend request already pending")
            elif existing["status"] == FriendStatus.BLOCKED.value:
                raise ValueError("Cannot send friend request")
        
        friend_doc = {
            "requester_id": requester_id,
            "receiver_id": receiver_id,
            "status": FriendStatus.PENDING.value,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
        
        result = await friends.insert_one(friend_doc)
        friend_doc["_id"] = str(result.inserted_id)
        return friend_doc
    
    @staticmethod
    async def accept_friend_request(request_id: str, user_id: str) -> dict:
        """Accept a friend request"""
        friends = get_friends_collection()
        
        request = await friends.find_one({"_id": ObjectId(request_id)})
        if not request:
            raise ValueError("Friend request not found")
        
        if request["receiver_id"] != user_id:
            raise ValueError("Only the receiver can accept this request")
        
        if request["status"] != FriendStatus.PENDING.value:
            raise ValueError("Request is not pending")
        
        result = await friends.find_one_and_update(
            {"_id": ObjectId(request_id)},
            {"$set": {
                "status": FriendStatus.ACCEPTED.value,
                "updated_at": datetime.utcnow()
            }},
            return_document=True
        )
        
        result["_id"] = str(result["_id"])
        return result
    
    @staticmethod
    async def reject_friend_request(request_id: str, user_id: str) -> dict:
        """Reject a friend request"""
        friends = get_friends_collection()
        
        request = await friends.find_one({"_id": ObjectId(request_id)})
        if not request:
            raise ValueError("Friend request not found")
        
        if request["receiver_id"] != user_id:
            raise ValueError("Only the receiver can reject this request")
        
        result = await friends.find_one_and_update(
            {"_id": ObjectId(request_id)},
            {"$set": {
                "status": FriendStatus.REJECTED.value,
                "updated_at": datetime.utcnow()
            }},
            return_document=True
        )
        
        result["_id"] = str(result["_id"])
        return result
    
    @staticmethod
    async def remove_friend(user_id: str, friend_id: str) -> bool:
        """Remove a friend (works for both parties)"""
        friends = get_friends_collection()
        
        result = await friends.delete_one({
            "$or": [
                {"requester_id": user_id, "receiver_id": friend_id, "status": FriendStatus.ACCEPTED.value},
                {"requester_id": friend_id, "receiver_id": user_id, "status": FriendStatus.ACCEPTED.value}
            ]
        })
        
        return result.deleted_count > 0
    
    @staticmethod
    async def get_friends(user_id: str) -> List[dict]:
        """Get all friends of a user"""
        friends = get_friends_collection()
        users = get_users_collection()
        
        cursor = friends.find({
            "$or": [
                {"requester_id": user_id, "status": FriendStatus.ACCEPTED.value},
                {"receiver_id": user_id, "status": FriendStatus.ACCEPTED.value}
            ]
        })
        
        result = []
        async for friend in cursor:
            # Get the other user's ID
            other_id = friend["receiver_id"] if friend["requester_id"] == user_id else friend["requester_id"]
            
            # Get user info
            user = await users.find_one({"_id": ObjectId(other_id)})
            if user and not user.get("is_deleted"):
                result.append({
                    "id": str(user["_id"]),
                    "username": user["username"],
                    "display_name": user.get("display_name"),
                    "avatar_url": user.get("avatar_url"),
                    "avatar_type": user.get("avatar_type", "static"),
                    "status": user.get("status", "online") if user.get("is_online") else "offline",
                    "is_online": user.get("is_online", False),
                    # Premium fields
                    "is_premium": user.get("is_premium", False),
                    "accent_color": user.get("accent_color"),
                    # Equipped relics (for frame/bubble rendering in DMs)
                    "equipped_relics": user.get("equipped_relics", {}),
                })
        
        return result
    
    @staticmethod
    async def get_pending_requests(user_id: str) -> List[dict]:
        """Get pending friend requests received by user"""
        friends = get_friends_collection()
        users = get_users_collection()
        
        cursor = friends.find({
            "receiver_id": user_id,
            "status": FriendStatus.PENDING.value
        })
        
        result = []
        async for request in cursor:
            requester = await users.find_one({"_id": ObjectId(request["requester_id"])})
            if requester:
                request["_id"] = str(request["_id"])
                # Nesting the requester details for the frontend
                request["requester"] = {
                    "id": str(requester["_id"]),
                    "username": requester["username"],
                    "display_name": requester.get("display_name"),
                    "avatar_url": requester.get("avatar_url"),
                    "is_premium": requester.get("is_premium", False),
                    "accent_color": requester.get("accent_color")
                }
                result.append(request)
        
        return result
    
    @staticmethod
    async def get_sent_requests(user_id: str) -> List[dict]:
        """Get friend requests sent by user"""
        friends = get_friends_collection()
        users = get_users_collection()
        
        cursor = friends.find({
            "requester_id": user_id,
            "status": FriendStatus.PENDING.value
        })
        
        result = []
        async for request in cursor:
            receiver = await users.find_one({"_id": ObjectId(request["receiver_id"])})
            if receiver:
                request["_id"] = str(request["_id"])
                # Nesting the receiver details for the frontend
                request["receiver"] = {
                    "id": str(receiver["_id"]),
                    "username": receiver["username"],
                    "display_name": receiver.get("display_name"),
                    "avatar_url": receiver.get("avatar_url"),
                    "is_premium": receiver.get("is_premium", False),
                    "accent_color": receiver.get("accent_color")
                }
                result.append(request)
        
        return result
    
    @staticmethod
    async def are_friends(user1_id: str, user2_id: str) -> bool:
        """Check if two users are friends"""
        friends = get_friends_collection()
        
        friend = await friends.find_one({
            "$or": [
                {"requester_id": user1_id, "receiver_id": user2_id, "status": FriendStatus.ACCEPTED.value},
                {"requester_id": user2_id, "receiver_id": user1_id, "status": FriendStatus.ACCEPTED.value}
            ]
        })
        
        return friend is not None
    
    @staticmethod
    async def cancel_friend_request(request_id: str, user_id: str) -> bool:
        """Cancel a sent friend request"""
        friends = get_friends_collection()
        
        result = await friends.delete_one({
            "_id": ObjectId(request_id),
            "requester_id": user_id,
            "status": FriendStatus.PENDING.value
        })
        
        return result.deleted_count > 0
    
    @staticmethod
    async def get_friendship_status(user_id: str, target_user_id: str) -> dict:
        """
        Get friendship status between two users.
        Returns: { status: 'friends'|'pending_sent'|'pending_received'|'none', request_id: str|None }
        """
        friends = get_friends_collection()
        
        # Look for any relationship between the two users
        friend_record = await friends.find_one({
            "$or": [
                {"requester_id": user_id, "receiver_id": target_user_id},
                {"requester_id": target_user_id, "receiver_id": user_id}
            ]
        })
        
        if not friend_record:
            return {"status": "none", "request_id": None}
        
        status = friend_record["status"]
        request_id = str(friend_record["_id"])
        
        if status == FriendStatus.ACCEPTED.value:
            return {"status": "friends", "request_id": request_id}
        elif status == FriendStatus.PENDING.value:
            # Check who sent the request
            if friend_record["requester_id"] == user_id:
                return {"status": "pending_sent", "request_id": request_id}
            else:
                return {"status": "pending_received", "request_id": request_id}
        elif status == FriendStatus.BLOCKED.value:
            return {"status": "blocked", "request_id": None}
        else:
            return {"status": "none", "request_id": None}


from app.services.oracle_service import ORACLE_ID

class DirectMessageService:
    """Direct messaging business logic"""
    
    @staticmethod
    async def send_message(
        sender_id: str,
        receiver_id: str,
        content: str,
        attachments: List[dict] = None,
        reply_to_id: str = None,
        is_forwarded: bool = False,
        forward_origin_id: str = None,
        forward_server_name: str = None
    ) -> dict:
        """Send a direct message"""
        dms = get_direct_messages_collection()
        users = get_users_collection()
        
        # Check if they are friends (Bypass for Oracle)
        if sender_id != ORACLE_ID and receiver_id != ORACLE_ID:
            if not await FriendService.are_friends(sender_id, receiver_id):
                raise ValueError("Can only message friends")
        
        message_doc = {
            "sender_id": sender_id,
            "receiver_id": receiver_id,
            "content": content,
            "attachments": attachments or [],
            "timestamp": datetime.utcnow(),
            "is_read": False,  # New messages are unread
        }
        
        # Handle forwarding
        if is_forwarded:
            message_doc["is_forwarded"] = True
            if forward_origin_id:
                message_doc["forward_origin_id"] = forward_origin_id
            if forward_server_name:
                message_doc["forward_server_name"] = forward_server_name
        
        # Handle reply
        if reply_to_id:
            replied_msg = await dms.find_one({"_id": ObjectId(reply_to_id)})
            if replied_msg:
                # Get replied message author info
                replied_user = await users.find_one({"_id": ObjectId(replied_msg["sender_id"])})
                message_doc["reply_to"] = {
                    "message_id": reply_to_id,
                    "content": replied_msg.get("content", "")[:100],  # Truncate to 100 chars
                    "username": replied_user.get("username", "Unknown") if replied_user else "Unknown",
                    "user_id": replied_msg["sender_id"]
                }
        
        result = await dms.insert_one(message_doc)
        message_doc["_id"] = str(result.inserted_id)
        return message_doc
    
    @staticmethod
    async def get_message_by_id(message_id: str) -> Optional[dict]:
        """Get a DM message by ID"""
        dms = get_direct_messages_collection()
        message = await dms.find_one({"_id": ObjectId(message_id)})
        if message:
            message["_id"] = str(message["_id"])
        return message
    
    @staticmethod
    async def get_conversation(user1_id: str, user2_id: str, limit: int = 50, before_id: str = None) -> List[dict]:
        """
        Get messages between two users.
        Returns last 50 messages by default.
        """
        dms = get_direct_messages_collection()
        users = get_users_collection()
        
        query = {
            "$or": [
                {"sender_id": user1_id, "receiver_id": user2_id},
                {"sender_id": user2_id, "receiver_id": user1_id}
            ]
        }
        
        # Pagination using before_id
        if before_id:
            query["_id"] = {"$lt": ObjectId(before_id)}
        
        cursor = dms.find(query).sort("timestamp", -1).limit(limit)
        
        # Get user info cache
        user1 = await users.find_one({"_id": ObjectId(user1_id)})
        user2 = await users.find_one({"_id": ObjectId(user2_id)})
        
        user_cache = {
            user1_id: user1,
            user2_id: user2
        }
        
        result = []
        async for message in cursor:
            message["_id"] = str(message["_id"])
            
            # Add sender info
            sender = user_cache.get(message["sender_id"])
            if sender:
                message["sender_username"] = sender["username"]
                message["sender_display_name"] = sender.get("display_name")
                message["sender_display_name"] = sender.get("display_name")
                message["sender_avatar_url"] = sender.get("avatar_url")
                # Premium fields
                message["sender_is_premium"] = sender.get("is_premium", False)
                message["sender_accent_color"] = sender.get("accent_color")
            
            result.append(message)
        
        # Reverse to get chronological order
        result.reverse()
        return result
    
    @staticmethod
    async def get_recent_conversations(user_id: str) -> List[dict]:
        """Get list of users with recent DM conversations"""
        dms = get_direct_messages_collection()
        users = get_users_collection()
        
        # Find unique conversation partners
        pipeline = [
            {"$match": {
                "$or": [
                    {"sender_id": user_id},
                    {"receiver_id": user_id}
                ]
            }},
            {"$sort": {"timestamp": -1}},
            {"$group": {
                "_id": {
                    "$cond": [
                        {"$eq": ["$sender_id", user_id]},
                        "$receiver_id",
                        "$sender_id"
                    ]
                },
                "last_message": {"$first": "$$ROOT"}
            }},
            {"$limit": 20}
        ]
        
        cursor = dms.aggregate(pipeline)
        
        result = []
        async for item in cursor:
            partner_id = item["_id"]
            partner = await users.find_one({"_id": ObjectId(partner_id)})
            
            if partner and not partner.get("is_deleted"):
                result.append({
                    "user": {
                        "id": str(partner["_id"]),
                        "username": partner["username"],
                        "display_name": partner.get("display_name"),
                        "display_name": partner.get("display_name"),
                        "avatar_url": partner.get("avatar_url"),
                        # Premium fields
                        "is_premium": partner.get("is_premium", False),
                        "accent_color": partner.get("accent_color")
                    },
                    "last_message": {
                        "content": item["last_message"]["content"][:50],
                        "timestamp": item["last_message"]["timestamp"],
                        "is_mine": item["last_message"]["sender_id"] == user_id
                    }
                })
        
        return result

    @staticmethod
    async def edit_message(user_id: str, message_id: str, new_content: str) -> dict:
        """Edit a direct message"""
        dms = get_direct_messages_collection()

        message = await dms.find_one({"_id": ObjectId(message_id)})
        if not message:
            raise ValueError("Message not found")

        if message["sender_id"] != user_id:
            raise ValueError("Can only edit your own messages")

        updated_message = await dms.find_one_and_update(
            {"_id": ObjectId(message_id)},
            {
                "$set": {
                    "content": new_content,
                    "updated_at": datetime.utcnow()
                }
            },
            return_document=True
        )

        updated_message["_id"] = str(updated_message["_id"])
        return updated_message

    @staticmethod
    async def delete_message(user_id: str, message_id: str) -> bool:
        """Delete a direct message"""
        dms = get_direct_messages_collection()

        message = await dms.find_one({"_id": ObjectId(message_id)})
        if not message:
            raise ValueError("Message not found")

        if message["sender_id"] != user_id:
            raise ValueError("Can only delete your own messages")

        result = await dms.delete_one({"_id": ObjectId(message_id)})
        return result.deleted_count > 0

    @staticmethod
    async def get_unread_counts(user_id: str) -> dict:
        """
        Get unread message counts per friend.
        Returns: { friend_id: count, ... } and total count
        """
        dms = get_direct_messages_collection()
        
        pipeline = [
            {"$match": {
                "receiver_id": user_id,
                "is_read": {"$ne": True}  # Unread messages
            }},
            {"$group": {
                "_id": "$sender_id",
                "count": {"$sum": 1}
            }}
        ]
        
        cursor = dms.aggregate(pipeline)
        
        counts = {}
        total = 0
        async for item in cursor:
            counts[item["_id"]] = item["count"]
            total += item["count"]
        
        return {"counts": counts, "total": total}

    @staticmethod
    async def mark_conversation_read(user_id: str, friend_id: str) -> int:
        """
        Mark all messages from a friend as read.
        Returns: number of messages marked as read
        """
        dms = get_direct_messages_collection()
        
        result = await dms.update_many(
            {
                "sender_id": friend_id,
                "receiver_id": user_id,
                "is_read": {"$ne": True}
            },
            {"$set": {"is_read": True}}
        )
        
        return result.modified_count

    @staticmethod
    async def add_reaction(message_id: str, user_id: str, emoji: str) -> Optional[dict]:
        """Add a reaction to a DM message"""
        dms = get_direct_messages_collection()
        
        result = await dms.find_one_and_update(
            {"_id": ObjectId(message_id)},
            {"$addToSet": {f"reactions.{emoji}": user_id}},
            return_document=True
        )
        
        if result:
            result["_id"] = str(result["_id"])
        return result

    @staticmethod
    async def remove_reaction(message_id: str, user_id: str, emoji: str) -> Optional[dict]:
        """Remove a reaction from a DM message"""
        dms = get_direct_messages_collection()
        
        result = await dms.find_one_and_update(
            {"_id": ObjectId(message_id)},
            {"$pull": {f"reactions.{emoji}": user_id}},
            return_document=True
        )
        
        if result:
            result["_id"] = str(result["_id"])
            # Clean up empty emoji arrays
            if result.get("reactions", {}).get(emoji) == []:
                await dms.update_one(
                    {"_id": ObjectId(message_id)},
                    {"$unset": {f"reactions.{emoji}": ""}}
                )
        return result

    @staticmethod
    async def pin_message(message_id: str) -> Optional[dict]:
        """Pin a direct message"""
        dms = get_direct_messages_collection()
        
        result = await dms.find_one_and_update(
            {"_id": ObjectId(message_id)},
            {"$set": {"is_pinned": True}},
            return_document=True
        )
        
        if result:
            result["_id"] = str(result["_id"])
        return result

    @staticmethod
    async def unpin_message(message_id: str) -> Optional[dict]:
        """Unpin a direct message"""
        dms = get_direct_messages_collection()
        
        result = await dms.find_one_and_update(
            {"_id": ObjectId(message_id)},
            {"$set": {"is_pinned": False}},
            return_document=True
        )
        
        if result:
            result["_id"] = str(result["_id"])
        return result

    @staticmethod
    async def get_pinned_messages(user1_id: str, user2_id: str) -> List[dict]:
        """Get pinned DM messages between two users"""
        dms = get_direct_messages_collection()
        users = get_users_collection()
        
        query = {
            "$or": [
                {"sender_id": user1_id, "receiver_id": user2_id},
                {"sender_id": user2_id, "receiver_id": user1_id}
            ],
            "is_pinned": True
        }
        
        cursor = dms.find(query).sort("timestamp", 1)
        
        # User cache
        user1 = await users.find_one({"_id": ObjectId(user1_id)})
        user2 = await users.find_one({"_id": ObjectId(user2_id)})
        
        user_cache = {}
        if user1: user_cache[user1_id] = user1
        if user2: user_cache[user2_id] = user2
        
        result = []
        async for message in cursor:
            message["_id"] = str(message["_id"])
            
            sender = user_cache.get(message["sender_id"])
            if sender:
                message["sender_username"] = sender["username"]
                message["sender_display_name"] = sender.get("display_name")
                message["sender_display_name"] = sender.get("display_name")
                message["sender_avatar_url"] = sender.get("avatar_url")
                # Premium fields
                message["sender_is_premium"] = sender.get("is_premium", False)
                message["sender_accent_color"] = sender.get("accent_color")
            
            result.append(message)
            
        return result
