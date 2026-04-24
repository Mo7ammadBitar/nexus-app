"""
Voice Chat Namespace
Handles WebRTC signaling and voice channel state.

SECURITY: All connections are authenticated via JWT token verification
during the Socket.IO handshake. No user_id trust from client.
"""
import socketio
from typing import Dict, List, Optional
from app.utils.security import decode_access_token


class VoiceNamespace(socketio.AsyncNamespace):
    def __init__(self, namespace=None):
        super().__init__(namespace=namespace)
        # Connected users: {sid: {user_id, room_id, ...}}
        self.users: Dict[str, dict] = {}
        # Rooms: {room_id: [sid, ...]}
        self.rooms: Dict[str, List[str]] = {}
        # Verified identities from JWT: {sid: {user_id, username}}
        self.verified_identities: Dict[str, dict] = {}

    async def on_connect(self, sid, environ, auth=None):
        """
        Handle new voice connection — JWT-authenticated handshake.
        Rejects connection if token is missing, expired, or invalid.
        """
        if not auth or not auth.get("token"):
            raise ConnectionRefusedError("JWT token required in auth.token")
        
        payload = decode_access_token(auth["token"])
        if payload is None:
            raise ConnectionRefusedError("Invalid or expired JWT token")
        
        user_id = payload.get("sub")
        if not user_id:
            raise ConnectionRefusedError("Malformed token: missing subject")
        
        username = payload.get("username", "Unknown")
        
        # Store verified identity for use in join_voice / join_dm_call
        self.verified_identities[sid] = {
            "user_id": user_id,
            "username": username
        }
        
        print(f"🎤 Voice connected: {sid} (user: {username}) [JWT verified]")

    async def on_disconnect(self, sid):
        """Handle disconnection"""
        print(f"🎤 Voice disconnected: {sid}")
        await self._handle_leave(sid)
        # Clean up verified identity
        self.verified_identities.pop(sid, None)

    async def on_join_voice(self, sid, data):
        """
        User joins a voice room.
        Identity is derived from the JWT verified during connect.
        data: { room_id: str }
        """
        # Use verified identity from JWT — never trust client-supplied user_id
        identity = self.verified_identities.get(sid)
        if not identity:
            return {"error": "Not authenticated"}
        
        room_id = data.get("room_id")
        user_id = identity["user_id"]
        username = identity["username"]

        if not room_id:
            return {"error": "Missing room_id"}

        # --- FIX: ZOMBIE CLEANUP ---
        # Check if this user_id is already in the room with a different SID
        # and remove the ghost connection to prevent duplicate logic.
        sids_to_remove = []
        for existing_sid, info in self.users.items():
            if info["user_id"] == user_id and existing_sid != sid:
                print(f"👻 Removing ghost session for {username} ({existing_sid})")
                sids_to_remove.append(existing_sid)
        
        for ghost_sid in sids_to_remove:
            await self._handle_leave(ghost_sid)
        # ---------------------------

        # Store user info
        self.users[sid] = {
            "sid": sid,
            "room_id": room_id,
            "user_id": user_id,
            "username": username,
            "is_muted": False
        }

        # Add to room
        self.enter_room(sid, room_id)
        
        # Get other users in room
        users_in_room = []
        
        for other_sid, info in self.users.items():
            if info["room_id"] == room_id and other_sid != sid:
                users_in_room.append({
                    "sid": other_sid,
                    "user_id": info["user_id"],
                    "username": info["username"],
                    "is_muted": info["is_muted"]
                })

        # Notify this user about others
        await self.emit("all_users", users_in_room, to=sid)
        
        print(f"🎤 {username} joined room {room_id}")

    async def on_sending_signal(self, sid, payload):
        """
        Relay WebRTC signal to a specific user.
        payload: { userToSignal: sid, signal: dict, callerID: sid }
        """
        user_to_signal = payload.get("userToSignal")
        
        # Emit 'user_joined' to the *existing* user, containing the signal from the new user
        # This matches the 'simple-peer' tutorial pattern where 'user_joined' serves as 'incoming_call'
        await self.emit("user_joined", {
            "signal": payload.get("signal"),
            "callerID": payload.get("callerID"),
            "username": self.users.get(sid, {}).get("username"),
            "user_id": self.users.get(sid, {}).get("user_id"),
            "is_muted": self.users.get(sid, {}).get("is_muted", False)
        }, to=user_to_signal)

    async def on_returning_signal(self, sid, payload):
        """
        Relay signal answer back to the caller.
        payload: { callerID: sid, signal: dict }
        """
        caller_id = payload.get("callerID")
        await self.emit("receiving_returned_signal", {
            "signal": payload.get("signal"),
            "id": sid 
        }, to=caller_id)

    async def on_toggle_mute(self, sid, payload):
        """
        Handle mute toggle and notify others.
        payload: { room_id: str, is_muted: bool }
        """
        is_muted = payload.get("is_muted")
        
        if sid not in self.users:
            print(f"⚠️ toggle_mute: User {sid} not found in users")
            return
        
        # Use stored room_id for reliability
        user_info = self.users[sid]
        room_id = user_info["room_id"]
        user_info["is_muted"] = is_muted
        
        print(f"🔇 User {user_info['username']} {'muted' if is_muted else 'unmuted'} in room {room_id}")
            
        # Broadcast to room (excluding sender)
        await self.emit("user_muted", {
            "sid": sid,
            "user_id": user_info["user_id"],
            "is_muted": is_muted
        }, room=room_id, skip_sid=sid)
        
        print(f"📤 Broadcasted user_muted to room {room_id}")

    async def on_leave_voice(self, sid, data=None):
        """Handle explicit leave"""
        await self._handle_leave(sid)

    async def _handle_leave(self, sid):
        """Common leave logic"""
        if sid in self.users:
            user_info = self.users[sid]
            room_id = user_info["room_id"]
            is_dm = user_info.get("is_dm_call", False)
            
            # Remove from internal list
            del self.users[sid]
            
            # CRITICAL: Broadcast user_left BEFORE leaving the room
            # Otherwise the socket can't send to the room it already left
            event_name = "dm_user_left" if is_dm else "user_left"
            await self.emit(event_name, {
                "sid": sid,
                "user_id": user_info["user_id"]
            }, room=room_id)
            
            print(f"📤 Broadcasted {event_name}: {sid} to room {room_id}")
            
            # Now leave the socket room
            self.leave_room(sid, room_id)
            
        else:
            print(f"⚠️ {user_info['username']} left voice, but was not in the self.users dictionary")

    # =========================================================================
    # DIRECT MESSAGE (DM) VOICE CALL SPECIFIC EVENTS
    # =========================================================================

    def _get_dm_room_id(self, id1: str, id2: str) -> str:
        """Helper to deterministically generate an isolated DM room ID"""
        return f"dm_call_{min(id1, id2)}_{max(id1, id2)}"

    async def on_join_dm_call(self, sid, data):
        """
        User joins an isolated DM voice call room.
        Identity is derived from the JWT verified during connect.
        data: { target_user_id: str }
        """
        # Use verified identity from JWT — never trust client-supplied user_id
        identity = self.verified_identities.get(sid)
        if not identity:
            return {"error": "Not authenticated"}
        
        user_id = identity["user_id"]
        username = identity["username"]
        target_user_id = data.get("target_user_id")

        if not target_user_id:
            return {"error": "Missing target_user_id"}

        # Deterministically create isolated room ID for these exact 2 users
        room_id = self._get_dm_room_id(user_id, target_user_id)

        # Zombie cleanup
        sids_to_remove = []
        for existing_sid, info in self.users.items():
            if info["user_id"] == user_id and existing_sid != sid:
                print(f"👻 Removing ghost DM session for {username} ({existing_sid})")
                sids_to_remove.append(existing_sid)
        
        for ghost_sid in sids_to_remove:
            await self._handle_leave(ghost_sid)

        # Store user info mapping
        self.users[sid] = {
            "sid": sid,
            "room_id": room_id,
            "user_id": user_id,
            "username": username,
            "is_muted": False,
            "is_dm_call": True 
        }

        # Join the strict Socket.IO room
        self.enter_room(sid, room_id)
        
        # Gathering peers already in this specific DM room (should be max 1 other)
        users_in_room = []
        for other_sid, info in self.users.items():
            if info["room_id"] == room_id and other_sid != sid:
                users_in_room.append({
                    "sid": other_sid,
                    "user_id": info["user_id"],
                    "username": info["username"],
                    "is_muted": info["is_muted"]
                })

        # Inform the connecting user of exactly who is in this room
        await self.emit("dm_all_users", users_in_room, to=sid)
        print(f"📞 {username} joined strict DM call room {room_id}")

    async def on_sending_dm_signal(self, sid, payload):
        """
        Send WebRTC offer/ICE signal for DM call.
        payload: { userToSignal: sid, signal: dict, callerID: sid }
        """
        user_to_signal = payload.get("userToSignal")
        
        await self.emit("dm_user_joined", {
            "signal": payload.get("signal"),
            "callerID": payload.get("callerID"),
            "username": self.users.get(sid, {}).get("username"),
            "user_id": self.users.get(sid, {}).get("user_id"),
            "is_muted": self.users.get(sid, {}).get("is_muted", False)
        }, to=user_to_signal)

    async def on_returning_dm_signal(self, sid, payload):
        """
        Send WebRTC answer/ICE signal back to caller.
        payload: { callerID: sid, signal: dict }
        """
        caller_id = payload.get("callerID")
        await self.emit("dm_receiving_returned_signal", {
            "signal": payload.get("signal"),
            "id": sid 
        }, to=caller_id)

    async def on_toggle_dm_mute(self, sid, payload):
        """
        Toggle mute strictly within the DM active call room.
        payload: { is_muted: bool }
        """
        is_muted = payload.get("is_muted")
        
        if sid not in self.users:
            print(f"⚠️ toggle_dm_mute: User {sid} not found in users")
            return
        
        user_info = self.users[sid]
        room_id = user_info["room_id"]
        user_info["is_muted"] = is_muted
        
        print(f"🔇 User {user_info['username']} {'muted' if is_muted else 'unmuted'} in DM room {room_id}")
            
        await self.emit("dm_user_muted", {
            "sid": sid,
            "user_id": user_info["user_id"],
            "is_muted": is_muted
        }, room=room_id, skip_sid=sid)

    async def on_leave_dm_call(self, sid, data=None):
        """Explicitly leave a DM voice call."""
        await self._handle_leave(sid)

