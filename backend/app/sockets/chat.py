"""
Socket.IO Chat Handler
Real-time text messaging for channels

SECURITY: All connections are authenticated via JWT token verification
during the Socket.IO handshake. No user_id trust from client.
"""
import socketio
from datetime import datetime
from bson import ObjectId

from app.services.message_service import MessageService
from app.services.server_service import MemberService, ChannelService
from app.database import get_users_collection
from app.utils.security import decode_access_token

# Global online users tracker: {user_id: set(sids)}
online_users = {}


def _verify_socket_token(auth: dict) -> dict:
    """
    Verify JWT token from Socket.IO auth payload.
    Returns decoded JWT payload if valid.
    Raises ConnectionRefusedError if invalid.
    """
    if not auth:
        raise ConnectionRefusedError("Authentication required")
    
    token = auth.get("token")
    if not token:
        raise ConnectionRefusedError("JWT token required in auth.token")
    
    payload = decode_access_token(token)
    if payload is None:
        raise ConnectionRefusedError("Invalid or expired JWT token")
    
    user_id = payload.get("sub")
    if not user_id:
        raise ConnectionRefusedError("Malformed token: missing subject")
    
    username = payload.get("username", "Anonymous")
    
    return {"user_id": user_id, "username": username}


class ChatNamespace(socketio.AsyncNamespace):
    """
    Chat namespace for real-time messaging.
    Handles channel joining, message sending, and typing indicators.
    """
    
    def __init__(self, namespace="/chat"):
        super().__init__(namespace)
        # Track connected users: {sid: user_data}
        self.connected_users = {}
        # Track typing users per channel: {channel_id: {user_id: timestamp}}
        self.typing_users = {}
    
    def serialize_data(self, data):
        """Helper to convert ObjectId and datetime to string for JSON serialization"""
        if isinstance(data, list):
            return [self.serialize_data(item) for item in data]
        if isinstance(data, dict):
            new_data = {}
            for k, v in data.items():
                if isinstance(v, ObjectId):
                    new_data[k] = str(v)
                elif isinstance(v, datetime):
                    new_data[k] = v.isoformat()
                elif isinstance(v, dict) or isinstance(v, list):
                    new_data[k] = self.serialize_data(v)
                else:
                    new_data[k] = v
            return new_data
        return data

    async def on_connect(self, sid, environ, auth=None):
        """
        Handle user connection — JWT-authenticated handshake.
        Rejects connection if token is missing, expired, or invalid.
        """
        try:
            verified = _verify_socket_token(auth)
        except ConnectionRefusedError:
            raise  # Let socketio handle the rejection
        
        user_id = verified["user_id"]
        username = verified["username"]
        
        self.connected_users[sid] = {
            "user_id": user_id,
            "username": username,
            "channels": []
        }
        
        # Track globally and update DB
        if user_id not in online_users:
            online_users[user_id] = set()
            # First connection - mark as online in DB
            users = get_users_collection()
            await users.update_one(
                {"_id": ObjectId(user_id)},
                {"$set": {"is_online": True}}
            )
            # Broadcast to all connected clients
            await self.emit("user_online", {"user_id": user_id, "username": username})
            await self.emit("presence_update", {"user_id": user_id, "status": "online", "username": username})
        
        online_users[user_id].add(sid)
        
        # Join user-specific room for DMs and notifications
        await self.enter_room(sid, f"user_{user_id}") 
        
        print(f"🔌 Chat: {username} connected (sid: {sid}) [JWT verified]")
        return True

    async def on_join_user_room(self, sid, user_id):
        """Explicitly join user-specific room for DMs"""
        if sid not in self.connected_users:
            return {"error": "Not authenticated"}
        
        # Only allow joining your own room (prevent IDOR)
        authenticated_user_id = self.connected_users[sid]["user_id"]
        if str(user_id) != authenticated_user_id:
            print(f"⚠️ IDOR attempt blocked: {authenticated_user_id} tried to join room of {user_id}")
            return {"error": "Unauthorized"}
        
        print(f"✅ Socket: User {user_id} joined room {user_id}")
        await self.enter_room(sid, str(user_id))
        return {"success": True}
    
    async def on_disconnect(self, sid, *args, **kwargs):
        """Handle user disconnection"""
        if sid in self.connected_users:
            user = self.connected_users[sid]
            user_id = user["user_id"]
            print(f"🔌 Chat: {user['username']} disconnected")
            
            # Leave all channels
            for channel_id in user["channels"]:
                await self.leave_room(sid, f"channel_{channel_id}")
            
            # Remove from global tracker
            if user_id in online_users:
                online_users[user_id].discard(sid)
                if not online_users[user_id]:
                    # Last session disconnected - mark offline in DB
                    del online_users[user_id]
                    users = get_users_collection()
                    await users.update_one(
                        {"_id": ObjectId(user_id)},
                        {"$set": {"is_online": False, "last_seen": datetime.utcnow()}}
                    )
                    # Broadcast to all connected clients
                    await self.emit("user_offline", {"user_id": user_id})
                    await self.emit("presence_update", {"user_id": user_id, "status": "offline"})
            
            del self.connected_users[sid]
    
    async def on_join_channel(self, sid, data):
        """Join a channel room"""
        if sid not in self.connected_users:
            return {"error": "Not authenticated"}
        
        channel_id = data.get("channel_id")
        if not channel_id:
            return {"error": "channel_id required"}
        
        user = self.connected_users[sid]
        
        # Verify membership (get channel's server, check if user is member)
        channel = await ChannelService.get_channel_by_id(channel_id)
        if not channel:
            return {"error": "Channel not found"}
        
        member = await MemberService.get_member(channel["server_id"], user["user_id"])
        if not member:
            return {"error": "Not a member of this server"}
        
        # Check if muted
        if member.get("is_muted"):
            mute_expires = member.get("mute_expires_at")
            if mute_expires and mute_expires > datetime.utcnow():
                return {"error": f"Muted until {mute_expires.isoformat()}"}
        
        # Join room
        room = f"channel_{channel_id}"
        await self.enter_room(sid, room)
        user["channels"].append(channel_id)
        
        # Load recent messages
        messages = await MessageService.get_channel_messages(channel_id, limit=50)
        
        print(f"📢 {user['username']} joined channel {channel_id}")
        
        # Serialize messages (convert datetime/_id to string) before returning
        serialized_messages = self.serialize_data(messages)
        
        return {
            "success": True,
            "channel_id": channel_id,
            "messages": serialized_messages
        }
    
    async def on_leave_channel(self, sid, data):
        """Leave a channel room"""
        if sid not in self.connected_users:
            return {"error": "Not authenticated"}
        
        channel_id = data.get("channel_id")
        if not channel_id:
            return {"error": "channel_id required"}
        
        user = self.connected_users[sid]
        room = f"channel_{channel_id}"
        
        await self.leave_room(sid, room)
        if channel_id in user["channels"]:
            user["channels"].remove(channel_id)
        
        print(f"📢 {user['username']} left channel {channel_id}")
        return {"success": True}
    
    async def on_send_message(self, sid, data):
        """Send a message to a channel"""
        if sid not in self.connected_users:
            return {"error": "Not authenticated"}
        
        channel_id = data.get("channel_id")
        content = data.get("content", "").strip()
        
        if not channel_id or not content:
            return {"error": "channel_id and content required"}
        
        if len(content) > 2000:
            return {"error": "Message too long (max 2000 characters)"}
        
        user = self.connected_users[sid]
        
        # Verify membership and mute status
        channel = await ChannelService.get_channel_by_id(channel_id)
        if not channel:
            return {"error": "Channel not found"}
        
        member = await MemberService.get_member(channel["server_id"], user["user_id"])
        if not member:
            return {"error": "Not a member of this server"}
        
        if member.get("is_muted"):
            mute_expires = member.get("mute_expires_at")
            if not mute_expires or mute_expires > datetime.utcnow():
                return {"error": "You are muted in this server"}
        
        # Save message
        message = await MessageService.create_message(
            channel_id=channel_id,
            user_id=user["user_id"],
            content=content,
            attachments=data.get("attachments", [])
        )
        
        # Get user info
        users_col = get_users_collection()
        user_doc = await users_col.find_one({"_id": ObjectId(user["user_id"])})
        
        if user_doc:
            message["username"] = user_doc["username"]
            message["display_name"] = user_doc.get("display_name")
            message["avatar_url"] = user_doc.get("avatar_url")
        
        # Serialize message before emitting
        serialized_message = self.serialize_data(message)
        
        # Broadcast to channel
        room = f"channel_{channel_id}"
        await self.emit("new_message", serialized_message, room=room)
        
        # Quest: increment total_messages_sent
        try:
            await users_col.update_one(
                {"_id": ObjectId(user["user_id"])},
                {"$inc": {"total_messages_sent": 1}}
            )
        except Exception:
            pass  # Non-critical, don't break messaging
        
        return {"success": True, "message": serialized_message}
    
    async def on_typing_start(self, sid, data):
        """User started typing"""
        if sid not in self.connected_users:
            print(f"⚠️ Typing start ignored: SID {sid} not connected")
            return
        
        channel_id = data.get("channel_id")
        if not channel_id:
            print(f"⚠️ Typing start ignored: No channel_id in {data}")
            return
        
        user = self.connected_users[sid]
        
        # Initialize channel typing dict if needed
        if channel_id not in self.typing_users:
            self.typing_users[channel_id] = {}
        
        self.typing_users[channel_id][user["user_id"]] = datetime.utcnow()
        
        # Broadcast typing indicator
        room = f"channel_{channel_id}"
        await self.emit("user_typing", {
            "channel_id": channel_id,
            "user_id": user["user_id"],
            "username": user["username"]
        }, room=room, skip_sid=sid)
    
    async def on_typing_stop(self, sid, data):
        """User stopped typing"""
        if sid not in self.connected_users:
            return
        
        channel_id = data.get("channel_id")
        if not channel_id:
            return
        
        user = self.connected_users[sid]
        
        # Remove from typing users
        if channel_id in self.typing_users:
            self.typing_users[channel_id].pop(user["user_id"], None)
        
        room = f"channel_{channel_id}"
        await self.emit("user_stopped_typing", {
            "channel_id": channel_id,
            "user_id": user["user_id"]
        }, room=room, skip_sid=sid)
    
    async def on_dm_typing_start(self, sid, data):
        """User started typing in a DM"""
        if sid not in self.connected_users:
            return
        
        receiver_id = data.get("receiver_id")
        if not receiver_id:
            return
        
        user = self.connected_users[sid]
        
        # Emit to the receiver's personal room
        await self.emit("dm_user_typing", {
            "sender_id": user["user_id"],
            "sender_username": user["username"],
            "receiver_id": receiver_id
        }, room=f"user_{receiver_id}")
    
    async def on_dm_typing_stop(self, sid, data):
        """User stopped typing in a DM"""
        if sid not in self.connected_users:
            return
        
        receiver_id = data.get("receiver_id")
        if not receiver_id:
            return
        
        user = self.connected_users[sid]
        
        # Emit to the receiver's personal room
        await self.emit("dm_user_stopped_typing", {
            "sender_id": user["user_id"],
            "receiver_id": receiver_id
        }, room=f"user_{receiver_id}")

    # =========================================================================
    # DIRECT MESSAGE (DM) CALL NOTIFICATIONS
    # Routings for rings, declines, and cancels globally.
    # =========================================================================

    async def on_initiate_dm_call(self, sid, data):
        """User initiates a DM voice call with someone globally"""
        if sid not in self.connected_users:
            return
        
        receiver_id = data.get("receiver_id")
        if not receiver_id:
            return
            
        user = self.connected_users[sid]
        
        users_col = get_users_collection()
        user_doc = await users_col.find_one({"_id": ObjectId(user["user_id"])})
        avatar_url = user_doc.get("avatar_url") if user_doc else None
        
        # Emit to the receiver's personal room
        # We pass caller info so the modal can show who is ringing
        await self.emit("incoming_dm_call", {
            "caller_id": user["user_id"],
            "caller_username": user["username"],
            "caller_avatar": avatar_url,
            "receiver_id": receiver_id
        }, room=f"user_{receiver_id}")

    async def on_decline_dm_call(self, sid, data):
        """User explicitly declines a ringing DM call"""
        if sid not in self.connected_users:
            return
            
        caller_id = data.get("caller_id")
        if not caller_id:
            return
            
        user = self.connected_users[sid]
        
        # Ring the caller's room to notify they were declined
        await self.emit("dm_call_declined", {
            "declined_by": user["user_id"]
        }, room=f"user_{caller_id}")

    async def on_cancel_dm_call(self, sid, data):
        """Caller hangs up before target answers"""
        if sid not in self.connected_users:
            return
            
        receiver_id = data.get("receiver_id")
        if not receiver_id:
            return
            
        user = self.connected_users[sid]
        
        await self.emit("dm_call_cancelled", {
            "cancelled_by": user["user_id"]
        }, room=f"user_{receiver_id}")

    async def on_accept_dm_call(self, sid, data):
        """Target accepts the call, notify caller"""
        if sid not in self.connected_users:
            return
            
        caller_id = data.get("caller_id")
        if not caller_id:
            return
            
        user = self.connected_users[sid]
        
        # Ring the caller's room to notify they were accepted
        await self.emit("dm_call_accepted", {
            "accepted_by": user["user_id"]
        }, room=f"user_{caller_id}")

    # =========================================================================
    # MULTIPLAYER GAME SESSION EVENTS
    # Real-time move relay for TicTacToe / RPS between two players.
    # =========================================================================

    async def on_game_join_room(self, sid, data):
        """Player joins a game-specific room for real-time move exchange"""
        if sid not in self.connected_users:
            return {"error": "Not authenticated"}
        
        game_room_id = data.get("game_room_id")
        if not game_room_id:
            return {"error": "game_room_id required"}
        
        user = self.connected_users[sid]
        await self.enter_room(sid, game_room_id)
        
        # Notify the other player that this player is ready
        await self.emit("game:player_joined", {
            "user_id": user["user_id"],
            "username": user["username"],
            "game_room_id": game_room_id,
        }, room=game_room_id, skip_sid=sid)
        
        print(f"🎮 {user['username']} joined game room {game_room_id}")
        return {"success": True}

    async def on_game_move(self, sid, data):
        """Player submits a move — relay to opponent in the game room"""
        if sid not in self.connected_users:
            return {"error": "Not authenticated"}
        
        game_room_id = data.get("game_room_id")
        if not game_room_id:
            return {"error": "game_room_id required"}
        
        user = self.connected_users[sid]
        
        # Relay the move to the other player in the room
        await self.emit("game:move_made", {
            "user_id": user["user_id"],
            "username": user["username"],
            "game_room_id": game_room_id,
            "move": data.get("move"),           # For TTT: cell index (0-8)
            "move_type": data.get("move_type"),  # For RPS: "rock"/"paper"/"scissors"
        }, room=game_room_id, skip_sid=sid)
        
        return {"success": True}

    async def on_game_leave(self, sid, data):
        """Player leaves a game room"""
        if sid not in self.connected_users:
            return
        
        game_room_id = data.get("game_room_id")
        if not game_room_id:
            return
        
        user = self.connected_users[sid]
        
        # Notify opponent
        await self.emit("game:player_left", {
            "user_id": user["user_id"],
            "username": user["username"],
            "game_room_id": game_room_id,
        }, room=game_room_id, skip_sid=sid)
        
        await self.leave_room(sid, game_room_id)
        print(f"🎮 {user['username']} left game room {game_room_id}")

        # Task 2: Challenge Card State Update (Closing the Room)
        if game_room_id.startswith("game_"):
            challenge_id = game_room_id[5:]
            try:
                from bson.objectid import ObjectId
                from app.database import get_direct_messages_collection
                from app.routers.games import _serialize_message, _build_updated_payload
                
                dms = get_direct_messages_collection()
                doc = await dms.find_one({"_id": ObjectId(challenge_id)})
                if doc:
                    cd = doc.get("challenge_data", {})
                    if cd.get("status") in ["pending", "accepted"]:
                        await dms.update_one(
                            {"_id": doc["_id"]},
                            {"$set": {"challenge_data.status": "expired"}}
                        )
                        updated_doc = await dms.find_one({"_id": doc["_id"]})
                        serialized = _serialize_message(updated_doc.copy())
                        updated_payload = _build_updated_payload(updated_doc, serialized["challenge_data"])
                        
                        challenger_id = str(doc["sender_id"])
                        receiver_id = str(doc["receiver_id"])
                        
                        await self.emit("dm_updated", updated_payload, room=f"user_{challenger_id}")
                        await self.emit("dm_updated", updated_payload, room=f"user_{receiver_id}")
            except Exception as e:
                print(f"Error handling game_leave status update: {e}")