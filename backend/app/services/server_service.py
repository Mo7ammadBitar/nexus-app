"""
Server and Channel Service - Business Logic
"""
from datetime import datetime, timedelta
from typing import Optional, List
from bson import ObjectId
import secrets
import string

from app.database import (
    get_servers_collection,
    get_members_collection,
    get_channels_collection,
    get_users_collection,
)
from app.models.server import ServerRole, ChannelType


class ServerService:
    """Server business logic"""
    
    # Channel limits
    MAX_TEXT_CHANNELS = 30
    MAX_VOICE_CHANNELS = 5
    
    @staticmethod
    def generate_invite_code(length: int = 8) -> str:
        """Generate a unique invite code"""
        chars = string.ascii_letters + string.digits
        return ''.join(secrets.choice(chars) for _ in range(length))
    
    @staticmethod
    async def create_server(name: str, owner_id: str) -> dict:
        """Create a new server"""
        servers = get_servers_collection()
        members = get_members_collection()
        channels = get_channels_collection()
        
        # Generate unique invite code
        invite_code = ServerService.generate_invite_code()
        while await servers.find_one({"invite_code": invite_code}):
            invite_code = ServerService.generate_invite_code()
        
        # Create server document
        server_doc = {
            "name": name,
            "icon_url": None,
            "owner_id": owner_id,
            "invite_code": invite_code,
            "is_banned": False,
            "ban_reason": None,
            "ban_expires_at": None,
            "is_deleted": False,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
        
        result = await servers.insert_one(server_doc)
        server_id = str(result.inserted_id)
        server_doc["_id"] = server_id
        
        # Add owner as member with 'owner' role
        member_doc = {
            "server_id": server_id,
            "user_id": owner_id,
            "role": ServerRole.OWNER.value,
            "is_muted": False,
            "mute_reason": None,
            "mute_expires_at": None,
            "joined_at": datetime.utcnow(),
        }
        await members.insert_one(member_doc)
        
        # Create default general text channel
        general_channel = {
            "server_id": server_id,
            "name": "general",
            "type": ChannelType.TEXT.value,
            "allowed_members": [],
            "created_at": datetime.utcnow(),
        }
        await channels.insert_one(general_channel)
        
        # Create default voice channel
        voice_channel = {
            "server_id": server_id,
            "name": "Voice Chat",
            "type": ChannelType.VOICE.value,
            "allowed_members": [],
            "created_at": datetime.utcnow(),
        }
        await channels.insert_one(voice_channel)
        
        return server_doc
    
    @staticmethod
    async def get_server_by_id(server_id: str) -> Optional[dict]:
        """Get server by ID"""
        servers = get_servers_collection()
        server = await servers.find_one({
            "_id": ObjectId(server_id),
            "is_deleted": {"$ne": True}
        })
        if server:
            server["_id"] = str(server["_id"])
        return server
    
    @staticmethod
    async def get_server_by_invite_code(invite_code: str) -> Optional[dict]:
        """Get server by invite code"""
        servers = get_servers_collection()
        server = await servers.find_one({
            "invite_code": invite_code,
            "is_deleted": {"$ne": True},
            "is_banned": {"$ne": True}
        })
        if server:
            server["_id"] = str(server["_id"])
        return server
    
    @staticmethod
    async def get_user_servers(user_id: str) -> List[dict]:
        """Get all servers a user is member of"""
        members = get_members_collection()
        servers = get_servers_collection()
        
        # Get all memberships
        user_memberships = await members.find({"user_id": user_id}).to_list(100)
        server_ids = [ObjectId(m["server_id"]) for m in user_memberships]
        
        if not server_ids:
            return []
        
        # Get servers
        cursor = servers.find({
            "_id": {"$in": server_ids},
            "is_deleted": {"$ne": True}
        })
        
        result = []
        async for server in cursor:
            server["_id"] = str(server["_id"])
            
            # Get member count
            count = await members.count_documents({"server_id": server["_id"]})
            server["member_count"] = count
            
            result.append(server)
        
        return result
    
    @staticmethod
    async def update_server(server_id: str, update_data: dict) -> Optional[dict]:
        """Update server"""
        servers = get_servers_collection()
        update_data["updated_at"] = datetime.utcnow()
        
        result = await servers.find_one_and_update(
            {"_id": ObjectId(server_id)},
            {"$set": update_data},
            return_document=True
        )
        
        if result:
            result["_id"] = str(result["_id"])
        return result
    
    @staticmethod
    async def delete_server(server_id: str) -> bool:
        """Soft delete server"""
        servers = get_servers_collection()
        result = await servers.update_one(
            {"_id": ObjectId(server_id)},
            {"$set": {"is_deleted": True, "updated_at": datetime.utcnow()}}
        )
        return result.modified_count > 0
    
    @staticmethod
    async def hard_delete_server(server_id: str) -> bool:
        """Permanently delete server and all related data"""
        servers = get_servers_collection()
        members = get_members_collection()
        channels = get_channels_collection()
        
        # Delete members
        await members.delete_many({"server_id": server_id})
        
        # Delete channels
        await channels.delete_many({"server_id": server_id})
        
        # Delete server
        result = await servers.delete_one({"_id": ObjectId(server_id)})
        return result.deleted_count > 0
    
    @staticmethod
    async def ban_server(server_id: str, reason: str, duration_days: Optional[int] = None) -> dict:
        """Ban a server"""
        servers = get_servers_collection()
        
        ban_expires = None
        if duration_days:
            ban_expires = datetime.utcnow() + timedelta(days=duration_days)
        
        result = await servers.find_one_and_update(
            {"_id": ObjectId(server_id)},
            {"$set": {
                "is_banned": True,
                "ban_reason": reason,
                "ban_expires_at": ban_expires,
                "updated_at": datetime.utcnow()
            }},
            return_document=True
        )
        
        if result:
            result["_id"] = str(result["_id"])
        return result


class MemberService:
    """Member management business logic"""
    
    @staticmethod
    async def join_server(server_id: str, user_id: str) -> dict:
        """Add user to server as member"""
        members = get_members_collection()
        
        # Check if already member
        existing = await members.find_one({
            "server_id": server_id,
            "user_id": user_id
        })
        if existing:
            raise ValueError("Already a member of this server")
        
        member_doc = {
            "server_id": server_id,
            "user_id": user_id,
            "role": ServerRole.MEMBER.value,
            "is_muted": False,
            "mute_reason": None,
            "mute_expires_at": None,
            "joined_at": datetime.utcnow(),
        }
        
        result = await members.insert_one(member_doc)
        member_doc["_id"] = str(result.inserted_id)
        return member_doc
    
    @staticmethod
    async def leave_server(server_id: str, user_id: str) -> bool:
        """Remove user from server"""
        members = get_members_collection()
        
        # Check if owner (owners can't leave, must transfer or delete)
        member = await members.find_one({
            "server_id": server_id,
            "user_id": user_id
        })
        
        if member and member.get("role") == ServerRole.OWNER.value:
            raise ValueError("Server owner cannot leave. Transfer ownership or delete the server.")
        
        result = await members.delete_one({
            "server_id": server_id,
            "user_id": user_id
        })
        return result.deleted_count > 0
    
    @staticmethod
    async def get_member(server_id: str, user_id: str) -> Optional[dict]:
        """Get member info"""
        members = get_members_collection()
        member = await members.find_one({
            "server_id": server_id,
            "user_id": user_id
        })
        if member:
            member["_id"] = str(member["_id"])
        return member
    
    @staticmethod
    async def get_server_members(server_id: str) -> List[dict]:
        """Get all members of a server with user info"""
        members = get_members_collection()
        users = get_users_collection()
        
        cursor = members.find({"server_id": server_id})
        result = []
        
        async for member in cursor:
            # Get user info
            user = await users.find_one({"_id": ObjectId(member["user_id"])})
            if user:
                member["_id"] = str(member["_id"])
                member["username"] = user["username"]
                member["display_name"] = user.get("display_name")
                member["avatar_url"] = user.get("avatar_url")
                member["is_premium"] = user.get("is_premium", False)
                member["status"] = user.get("status", "online")
                member["is_online"] = user.get("is_online", False)
                member["accent_color"] = user.get("accent_color")
                member["theme_color"] = user.get("theme_color")
                member["equipped_relics"] = user.get("equipped_relics", {})
                
                # Check if mute has expired
                if member.get("is_muted") and member.get("mute_expires_at"):
                    if datetime.utcnow() > member["mute_expires_at"]:
                        # Mute has expired - auto unmute
                        member["is_muted"] = False
                        member["mute_reason"] = None
                        member["mute_expires_at"] = None
                        # Update in database (fire and forget)
                        await members.update_one(
                            {"server_id": server_id, "user_id": member["user_id"]},
                            {"$set": {
                                "is_muted": False,
                                "mute_reason": None,
                                "mute_expires_at": None
                            }}
                        )
                
                result.append(member)
        
        return result
    
    @staticmethod
    async def promote_to_moderator(server_id: str, user_id: str) -> dict:
        """Promote member to moderator"""
        members = get_members_collection()
        
        result = await members.find_one_and_update(
            {"server_id": server_id, "user_id": user_id},
            {"$set": {"role": ServerRole.MODERATOR.value}},
            return_document=True
        )
        
        if not result:
            raise ValueError("Member not found")
        
        result["_id"] = str(result["_id"])
        return result
    
    @staticmethod
    async def demote_to_member(server_id: str, user_id: str) -> dict:
        """Demote moderator back to member"""
        members = get_members_collection()
        
        result = await members.find_one_and_update(
            {"server_id": server_id, "user_id": user_id},
            {"$set": {"role": ServerRole.MEMBER.value}},
            return_document=True
        )
        
        if not result:
            raise ValueError("Member not found")
        
        result["_id"] = str(result["_id"])
        return result
    
    @staticmethod
    async def mute_member(server_id: str, user_id: str, reason: str, duration_hours: Optional[int] = None) -> dict:
        """Mute a member in server"""
        members = get_members_collection()
        
        mute_expires = None
        if duration_hours:
            mute_expires = datetime.utcnow() + timedelta(hours=duration_hours)
        
        result = await members.find_one_and_update(
            {"server_id": server_id, "user_id": user_id},
            {"$set": {
                "is_muted": True,
                "mute_reason": reason,
                "mute_expires_at": mute_expires
            }},
            return_document=True
        )
        
        if not result:
            raise ValueError("Member not found")
        
        result["_id"] = str(result["_id"])
        return result
    
    @staticmethod
    async def unmute_member(server_id: str, user_id: str) -> dict:
        """Unmute a member"""
        members = get_members_collection()
        
        result = await members.find_one_and_update(
            {"server_id": server_id, "user_id": user_id},
            {"$set": {
                "is_muted": False,
                "mute_reason": None,
                "mute_expires_at": None
            }},
            return_document=True
        )
        
        if not result:
            raise ValueError("Member not found")
        
        result["_id"] = str(result["_id"])
        return result
    
    @staticmethod
    async def kick_member(server_id: str, user_id: str) -> bool:
        """Kick member from server"""
        return await MemberService.leave_server(server_id, user_id)


class ChannelService:
    """Channel business logic"""
    
    @staticmethod
    async def create_channel(server_id: str, name: str, channel_type: ChannelType) -> dict:
        """Create a new channel"""
        channels = get_channels_collection()
        
        # Check channel limits
        existing_count = await channels.count_documents({
            "server_id": server_id,
            "type": channel_type.value
        })
        
        if channel_type == ChannelType.TEXT and existing_count >= ServerService.MAX_TEXT_CHANNELS:
            raise ValueError(f"Maximum {ServerService.MAX_TEXT_CHANNELS} text channels per server")
        
        if channel_type == ChannelType.VOICE and existing_count >= ServerService.MAX_VOICE_CHANNELS:
            raise ValueError(f"Maximum {ServerService.MAX_VOICE_CHANNELS} voice channels per server")
        
        channel_doc = {
            "server_id": server_id,
            "name": name,
            "type": channel_type.value,
            "send_permission": "all",  # "all" = everyone, "mods_only" = owner + moderators
            "allowed_members": [],
            "created_at": datetime.utcnow(),
        }
        
        result = await channels.insert_one(channel_doc)
        channel_doc["_id"] = str(result.inserted_id)
        return channel_doc
    
    @staticmethod
    async def get_channel_by_id(channel_id: str) -> Optional[dict]:
        """Get channel by ID"""
        channels = get_channels_collection()
        channel = await channels.find_one({"_id": ObjectId(channel_id)})
        if channel:
            channel["_id"] = str(channel["_id"])
        return channel
    
    @staticmethod
    async def get_server_channels(server_id: str) -> List[dict]:
        """Get all channels in a server"""
        channels = get_channels_collection()
        cursor = channels.find({"server_id": server_id}).sort("created_at", 1)
        
        result = []
        async for channel in cursor:
            channel["_id"] = str(channel["_id"])
            result.append(channel)
        
        return result
    
    @staticmethod
    async def update_channel(channel_id: str, update_data: dict) -> Optional[dict]:
        """Update channel"""
        channels = get_channels_collection()
        
        result = await channels.find_one_and_update(
            {"_id": ObjectId(channel_id)},
            {"$set": update_data},
            return_document=True
        )
        
        if result:
            result["_id"] = str(result["_id"])
        return result
    
    @staticmethod
    async def delete_channel(channel_id: str) -> bool:
        """Delete channel"""
        channels = get_channels_collection()
        result = await channels.delete_one({"_id": ObjectId(channel_id)})
        return result.deleted_count > 0
    
    @staticmethod
    async def add_member_to_channel(channel_id: str, user_id: str) -> dict:
        """Add member to channel access list"""
        channels = get_channels_collection()
        
        result = await channels.find_one_and_update(
            {"_id": ObjectId(channel_id)},
            {"$addToSet": {"allowed_members": user_id}},
            return_document=True
        )
        
        if result:
            result["_id"] = str(result["_id"])
        return result
    
    @staticmethod
    async def remove_member_from_channel(channel_id: str, user_id: str) -> dict:
        """Remove member from channel access list"""
        channels = get_channels_collection()
        
        result = await channels.find_one_and_update(
            {"_id": ObjectId(channel_id)},
            {"$pull": {"allowed_members": user_id}},
            return_document=True
        )
        
        if result:
            result["_id"] = str(result["_id"])
        return result
