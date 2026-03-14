"""
WebRTC Signaling Handler
Peer-to-peer voice chat signaling via Socket.IO
"""
import socketio
from datetime import datetime
from typing import Dict, Set


class VoiceNamespace(socketio.AsyncNamespace):
    """
    Voice namespace for WebRTC signaling.
    Handles voice channel joining and peer connection signaling.
    Audio-only P2P with Opus codec.
    """
    
    def __init__(self, namespace="/voice"):
        super().__init__(namespace)
        # Track connected users: {sid: user_data}
        self.connected_users: Dict[str, dict] = {}
        # Track voice channel participants: {channel_id: {user_id: sid}}
        self.voice_channels: Dict[str, Dict[str, str]] = {}
    
    async def on_connect(self, sid, environ, auth=None):
        """Handle user connection"""
        if not auth or "user_id" not in auth:
            return False
        
        user_id = auth["user_id"]
        username = auth.get("username", "Anonymous")
        
        self.connected_users[sid] = {
            "user_id": user_id,
            "username": username,
            "current_channel": None,
            "is_muted": False,
            "is_deafened": False
        }
        
        print(f"🎤 Voice: {username} connected (sid: {sid})")
        return True
    
    async def on_disconnect(self, sid):
        """Handle user disconnection"""
        if sid in self.connected_users:
            user = self.connected_users[sid]
            
            # Leave voice channel if in one
            if user["current_channel"]:
                await self._leave_voice_channel(sid, user)
            
            print(f"🎤 Voice: {user['username']} disconnected")
            del self.connected_users[sid]
    
    async def _leave_voice_channel(self, sid, user):
        """Internal: leave voice channel and notify others"""
        channel_id = user["current_channel"]
        
        if channel_id in self.voice_channels:
            # Remove from channel
            self.voice_channels[channel_id].pop(user["user_id"], None)
            
            # Notify others in channel
            room = f"voice_{channel_id}"
            await self.emit("user_left_voice", {
                "channel_id": channel_id,
                "user_id": user["user_id"],
                "username": user["username"]
            }, room=room, skip_sid=sid)
            
            self.leave_room(sid, room)
            
            # Clean up empty channel
            if not self.voice_channels[channel_id]:
                del self.voice_channels[channel_id]
        
        user["current_channel"] = None
    
    async def on_join_voice(self, sid, data):
        """Join a voice channel"""
        if sid not in self.connected_users:
            return {"error": "Not authenticated"}
        
        channel_id = data.get("channel_id")
        if not channel_id:
            return {"error": "channel_id required"}
        
        user = self.connected_users[sid]
        
        # Leave current channel if in one
        if user["current_channel"]:
            await self._leave_voice_channel(sid, user)
        
        # Initialize channel if needed
        if channel_id not in self.voice_channels:
            self.voice_channels[channel_id] = {}
        
        # Join channel
        room = f"voice_{channel_id}"
        self.enter_room(sid, room)
        self.voice_channels[channel_id][user["user_id"]] = sid
        user["current_channel"] = channel_id
        
        # Get existing participants (for peer connections)
        participants = [
            {"user_id": uid, "username": self._get_username_by_user_id(uid)}
            for uid in self.voice_channels[channel_id]
            if uid != user["user_id"]
        ]
        
        # Notify others
        await self.emit("user_joined_voice", {
            "channel_id": channel_id,
            "user_id": user["user_id"],
            "username": user["username"]
        }, room=room, skip_sid=sid)
        
        print(f"🎤 {user['username']} joined voice channel {channel_id}")
        
        return {
            "success": True,
            "channel_id": channel_id,
            "participants": participants,
            "codec_config": {
                "codec": "opus",
                "bitrate": 96000,     # 96kbps
                "channels": 2,         # Stereo
                "sample_rate": 48000   # 48kHz
            }
        }
    
    def _get_username_by_user_id(self, user_id):
        """Get username from user_id"""
        for user_data in self.connected_users.values():
            if user_data["user_id"] == user_id:
                return user_data["username"]
        return "Unknown"
    
    async def on_leave_voice(self, sid, data=None):
        """Leave current voice channel"""
        if sid not in self.connected_users:
            return {"error": "Not authenticated"}
        
        user = self.connected_users[sid]
        
        if not user["current_channel"]:
            return {"error": "Not in a voice channel"}
        
        await self._leave_voice_channel(sid, user)
        
        print(f"🎤 {user['username']} left voice channel")
        return {"success": True}
    
    async def on_offer(self, sid, data):
        """
        WebRTC offer - initiating peer connection.
        target_user_id: the user to send the offer to
        """
        if sid not in self.connected_users:
            return {"error": "Not authenticated"}
        
        target_user_id = data.get("target_user_id")
        offer = data.get("offer")
        
        if not target_user_id or not offer:
            return {"error": "target_user_id and offer required"}
        
        user = self.connected_users[sid]
        channel_id = user["current_channel"]
        
        if not channel_id:
            return {"error": "Not in a voice channel"}
        
        # Find target user's sid
        target_sid = self.voice_channels.get(channel_id, {}).get(target_user_id)
        if not target_sid:
            return {"error": "Target user not in channel"}
        
        # Send offer to target
        await self.emit("offer", {
            "from_user_id": user["user_id"],
            "from_username": user["username"],
            "offer": offer
        }, room=target_sid)
        
        return {"success": True}
    
    async def on_answer(self, sid, data):
        """
        WebRTC answer - responding to offer.
        target_user_id: the user who sent the offer
        """
        if sid not in self.connected_users:
            return {"error": "Not authenticated"}
        
        target_user_id = data.get("target_user_id")
        answer = data.get("answer")
        
        if not target_user_id or not answer:
            return {"error": "target_user_id and answer required"}
        
        user = self.connected_users[sid]
        channel_id = user["current_channel"]
        
        if not channel_id:
            return {"error": "Not in a voice channel"}
        
        target_sid = self.voice_channels.get(channel_id, {}).get(target_user_id)
        if not target_sid:
            return {"error": "Target user not in channel"}
        
        # Send answer to target
        await self.emit("answer", {
            "from_user_id": user["user_id"],
            "from_username": user["username"],
            "answer": answer
        }, room=target_sid)
        
        return {"success": True}
    
    async def on_ice_candidate(self, sid, data):
        """
        ICE candidate exchange for NAT traversal.
        """
        if sid not in self.connected_users:
            return {"error": "Not authenticated"}
        
        target_user_id = data.get("target_user_id")
        candidate = data.get("candidate")
        
        if not target_user_id or not candidate:
            return {"error": "target_user_id and candidate required"}
        
        user = self.connected_users[sid]
        channel_id = user["current_channel"]
        
        if not channel_id:
            return {"error": "Not in a voice channel"}
        
        target_sid = self.voice_channels.get(channel_id, {}).get(target_user_id)
        if not target_sid:
            return {"error": "Target user not in channel"}
        
        # Send ICE candidate to target
        await self.emit("ice_candidate", {
            "from_user_id": user["user_id"],
            "candidate": candidate
        }, room=target_sid)
        
        return {"success": True}
    
    async def on_mute(self, sid, data=None):
        """Toggle mute status"""
        if sid not in self.connected_users:
            return {"error": "Not authenticated"}
        
        user = self.connected_users[sid]
        user["is_muted"] = not user["is_muted"]
        
        channel_id = user["current_channel"]
        if channel_id:
            room = f"voice_{channel_id}"
            await self.emit("user_mute_changed", {
                "user_id": user["user_id"],
                "is_muted": user["is_muted"]
            }, room=room)
        
        return {"success": True, "is_muted": user["is_muted"]}
    
    async def on_deafen(self, sid, data=None):
        """Toggle deafen status"""
        if sid not in self.connected_users:
            return {"error": "Not authenticated"}
        
        user = self.connected_users[sid]
        user["is_deafened"] = not user["is_deafened"]
        
        # Deafening also mutes
        if user["is_deafened"]:
            user["is_muted"] = True
        
        channel_id = user["current_channel"]
        if channel_id:
            room = f"voice_{channel_id}"
            await self.emit("user_deafen_changed", {
                "user_id": user["user_id"],
                "is_deafened": user["is_deafened"],
                "is_muted": user["is_muted"]
            }, room=room)
        
        return {
            "success": True,
            "is_deafened": user["is_deafened"],
            "is_muted": user["is_muted"]
        }
    
    async def on_get_participants(self, sid, data):
        """Get current voice channel participants"""
        if sid not in self.connected_users:
            return {"error": "Not authenticated"}
        
        channel_id = data.get("channel_id")
        if not channel_id:
            return {"error": "channel_id required"}
        
        participants = []
        if channel_id in self.voice_channels:
            for user_id in self.voice_channels[channel_id]:
                user_data = None
                for u in self.connected_users.values():
                    if u["user_id"] == user_id:
                        user_data = u
                        break
                
                if user_data:
                    participants.append({
                        "user_id": user_id,
                        "username": user_data["username"],
                        "is_muted": user_data["is_muted"],
                        "is_deafened": user_data["is_deafened"]
                    })
        
        return {"participants": participants}
