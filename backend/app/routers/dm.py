"""
Direct Messages Routes
"""
from fastapi import APIRouter, HTTPException, status, Depends, Query, UploadFile, File, Form
from typing import Optional, List
import os
import uuid
import aiofiles
from bson import ObjectId
from app.database import get_users_collection

from app.middleware.auth import get_current_user
from app.services.friend_service import DirectMessageService, FriendService
from app.services.oracle_service import OracleService, ORACLE_ID
from app.schemas.dm import SendMessageRequest
from app.config import get_settings

settings = get_settings()
router = APIRouter(prefix="/dm", tags=["Direct Messages"])

# Allowed file types (same as messages)
ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]
ALLOWED_AUDIO_TYPES = [
    "audio/mpeg", "audio/wav", "audio/ogg", "audio/webm",
    "audio/m4a", "audio/mp4", "audio/x-m4a", "audio/aac"  # Voice message formats
]
ALLOWED_DOCUMENT_TYPES = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
]
ALLOWED_ARCHIVE_TYPES = [
    "application/zip",
    "application/x-rar-compressed",
    "application/vnd.rar",
]
ALLOWED_FILE_TYPES = ALLOWED_IMAGE_TYPES + ALLOWED_AUDIO_TYPES + ALLOWED_DOCUMENT_TYPES + ALLOWED_ARCHIVE_TYPES


@router.get("")
async def get_conversations(current_user: dict = Depends(get_current_user)):
    """Get list of recent DM conversations."""
    conversations = await DirectMessageService.get_recent_conversations(current_user["_id"])
    return {"conversations": conversations}


@router.get("/{friend_id}")
async def get_conversation(
    friend_id: str,
    limit: int = Query(default=50, ge=1, le=100),
    before_id: Optional[str] = Query(default=None),
    current_user: dict = Depends(get_current_user)
):
    """
    Get messages with a friend.
    Supports pagination using before_id.
    """
    # Check if they are friends (bypass for The Oracle)
    is_oracle = friend_id == ORACLE_ID
    if not is_oracle:
        are_friends = await FriendService.are_friends(current_user["_id"], friend_id)
        if not are_friends:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only view messages with friends"
            )
    
    messages = await DirectMessageService.get_conversation(
        current_user["_id"],
        friend_id,
        limit=limit,
        before_id=before_id
    )
    
    return {"messages": messages}


@router.post("/{friend_id}")
async def send_message(
    friend_id: str,
    content: Optional[str] = Form(None),
    reply_to_id: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    message_type: Optional[str] = Form(None),  # "voice" for voice messages
    duration: Optional[float] = Form(None),     # Duration in seconds for voice
    current_user: dict = Depends(get_current_user)
):
    """Send a direct message to a friend with optional file attachment."""
    # Check if they are friends (bypass for The Oracle)
    is_oracle = friend_id == ORACLE_ID
    if not is_oracle:
        are_friends = await FriendService.are_friends(current_user["_id"], friend_id)
        if not are_friends:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only message friends"
            )

    if not content and not file:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message content or file is required"
        )
    
    # Process file attachment
    attachments = []
    if file and file.filename:
        # Check file type
        ext = file.filename.split(".")[-1].lower() if file.filename else ""
        allowed_extensions = [
            "docx", "pdf", "pptx", "jpg", "jpeg", "png", "gif", "txt", "zip", "rar",
            "mp3", "wav", "ogg", "m4a", "webm", "mp4", "aac" 
        ]
        
        is_valid_type = file.content_type in ALLOWED_FILE_TYPES
        if not is_valid_type:
            # Try partial match
            for allowed in ALLOWED_FILE_TYPES:
                if file.content_type.startswith(allowed):
                    is_valid_type = True
                    break
        
        if not is_valid_type and ext not in allowed_extensions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File type not allowed: {file.content_type} ({ext})"
            )
        
        # Read file
        content_bytes = await file.read()
        
        # Check file size (max 10MB)
        if len(content_bytes) > settings.max_file_size_mb * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File too large: {file.filename}. Max size: {settings.max_file_size_mb}MB"
            )
        
        # Determine file type
        if message_type == "voice" and (file.content_type in ALLOWED_AUDIO_TYPES or ext in ["mp3", "wav", "ogg", "m4a", "webm", "aac"]):
            file_type = "voice"
            subdir = "voice"
        elif file.content_type in ALLOWED_IMAGE_TYPES or ext in ["jpg", "jpeg", "png", "gif", "webp"]:
            file_type = "image"
            subdir = "images"
        elif file.content_type in ALLOWED_AUDIO_TYPES or ext in ["mp3", "wav", "ogg", "m4a"]:
            file_type = "audio"
            subdir = "audio"
        elif file.content_type in ALLOWED_ARCHIVE_TYPES or ext in ["zip", "rar"]:
            file_type = "archive"
            subdir = "archives"
        else:
            file_type = "document"
            subdir = "documents"
        
        from app.services.cloudinary_service import upload_file
        
        try:
            await file.seek(0)
            secure_url = await upload_file(file, folder=f"dm/{subdir}")
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to upload attachment to Cloudinary: {str(e)}"
            )
            
        ext = file.filename.split(".")[-1] if file.filename else "bin"
        filename = f"{uuid.uuid4().hex[:12]}.{ext}"
        
        attachment_data = {
            "type": file_type,
            "url": secure_url,
            "filename": file.filename or filename,
            "size": len(content_bytes)
        }
        
        if file_type == "voice" and duration is not None:
            attachment_data["metadata"] = {
                "duration": duration
            }
        
        attachments.append(attachment_data)
    
    try:
        # 1. Save to Database
        message = await DirectMessageService.send_message(
            current_user["_id"],
            friend_id,
            content,
            attachments=attachments,
            reply_to_id=reply_to_id
        )

        # 2. Prepare Socket Payload (CRITICAL FIX: Convert ObjectIds to strings)
        # This prevents the 500 error / CORS error when emitting via socket
        socket_payload = {
            "_id": str(message["_id"]),
            "content": message.get("content"),
            "sender_id": str(message["sender_id"]),
            "receiver_id": str(message["receiver_id"]),
            "timestamp": message["timestamp"].isoformat() if hasattr(message["timestamp"], "isoformat") else str(message["timestamp"]),
            "attachments": message.get("attachments", []),
            "reply_to": message.get("reply_to"),
            "is_forwarded": message.get("is_forwarded", False),
            "is_pinned": message.get("is_pinned", False),
            # Populate sender info immediately for the UI
            "sender": {
                "username": current_user.get("username"),
                "avatar_url": current_user.get("avatar_url"),
                "display_name": current_user.get("display_name"),
                "_id": str(current_user["_id"])
            }
        }
        
        # Handle nested ObjectId in reply_to if exists
        if socket_payload["reply_to"] and "_id" in socket_payload["reply_to"]:
            socket_payload["reply_to"]["_id"] = str(socket_payload["reply_to"]["_id"])

        # 3. Emit via Socket.IO
        try:
            from app.socket_instance import sio
            # Emit to recipient's room
            await sio.emit("dm_new_message", socket_payload, room=str(friend_id), namespace="/chat")
            # Emit to sender's room (for sync across tabs)
            await sio.emit("dm_new_message", socket_payload, room=str(current_user["_id"]), namespace="/chat")
        except Exception as e:
            print(f"⚠️ Socket Emit Error: {e}")
            # We do NOT raise an exception here, so the HTTP response still succeeds

        # --- Oracle Auto-Reply ---
        if is_oracle:
            import asyncio
            # Generate AI reply (Now Async)
            reply_text = await OracleService.generate_oracle_response(content)
            # Save Oracle's reply to DB
            oracle_reply = await OracleService.save_oracle_reply(
                user_id=str(current_user["_id"]),
                reply_content=reply_text
            )
            # Build socket payload for Oracle's reply
            oracle_payload = {
                "_id": str(oracle_reply["_id"]),
                "content": oracle_reply["content"],
                "sender_id": ORACLE_ID,
                "receiver_id": str(current_user["_id"]),
                "timestamp": oracle_reply["timestamp"].isoformat() if hasattr(oracle_reply["timestamp"], "isoformat") else str(oracle_reply["timestamp"]),
                "attachments": [],
                "is_forwarded": False,
                "is_pinned": False,
                "is_system": True,
                "sender": {
                    "username": "The Oracle",
                    "avatar_url": None,
                    "display_name": "The Oracle",
                    "_id": ORACLE_ID,
                    "is_system": True
                }
            }
            # Emit Oracle reply to user after a short delay (contemplation)
            try:
                await asyncio.sleep(1.5)
                from app.socket_instance import sio
                await sio.emit("dm_new_message", oracle_payload, room=str(current_user["_id"]), namespace="/chat")
            except Exception as e:
                print(f"⚠️ Oracle Socket Emit Error: {e}")

        # Quest: increment total_messages_sent for DM
        try:
            users_col = get_users_collection()
            await users_col.update_one(
                {"_id": ObjectId(current_user["_id"])},
                {"$inc": {"total_messages_sent": 1}}
            )
        except Exception:
            pass  # Non-critical

        return {"message": "Message sent", "dm": message}

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except Exception as e:
        print(f"❌ Send Message Error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal Server Error during message send"
        )


@router.put("/message/{message_id}")
async def edit_message(
    message_id: str,
    request: SendMessageRequest,
    current_user: dict = Depends(get_current_user)
):
    """Edit a direct message."""
    try:
        updated_message = await DirectMessageService.edit_message(
            current_user["_id"],
            message_id,
            request.content
        )
        return {"message": "Message updated", "dm": updated_message}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


@router.delete("/message/{message_id}")
async def delete_message(
    message_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a direct message."""
    try:
        await DirectMessageService.delete_message(
            current_user["_id"],
            message_id
        )
        return {"message": "Message deleted"}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


@router.get("/unread/counts")
async def get_unread_counts(current_user: dict = Depends(get_current_user)):
    """Get unread message counts per friend and total."""
    result = await DirectMessageService.get_unread_counts(current_user["_id"])
    return result


@router.post("/{friend_id}/read")
async def mark_as_read(
    friend_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Mark all messages from a friend as read."""
    # Check if they are friends (bypass for The Oracle)
    is_oracle = friend_id == ORACLE_ID
    if not is_oracle:
        are_friends = await FriendService.are_friends(current_user["_id"], friend_id)
        if not are_friends:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only mark messages from friends as read"
            )
    
    count = await DirectMessageService.mark_conversation_read(current_user["_id"], friend_id)
    return {"message": "Messages marked as read", "count": count}


@router.post("/message/{message_id}/react")
async def add_reaction(
    message_id: str,
    emoji: str,
    current_user: dict = Depends(get_current_user)
):
    """Add a reaction to a DM message."""
    result = await DirectMessageService.add_reaction(message_id, current_user["_id"], emoji)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )
    
    # Quest: increment total_reactions_given
    try:
        users_col = get_users_collection()
        await users_col.update_one(
            {"_id": ObjectId(current_user["_id"])},
            {"$inc": {"total_reactions_given": 1}}
        )
    except Exception:
        pass  # Non-critical
    
    return {"message": "Reaction added", "reactions": result.get("reactions", {})}


@router.delete("/message/{message_id}/react")
async def remove_reaction(
    message_id: str,
    emoji: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Remove a reaction from a DM message."""
    result = await DirectMessageService.remove_reaction(message_id, current_user["_id"], emoji)
    return {"message": "Reaction removed", "reactions": result.get("reactions", {}) if result else {}}


@router.post("/{friend_id}/forward")
async def forward_message(
    friend_id: str,
    source_message_id: str = Form(...),
    source_type: str = Form(...),  # "channel" or "dm"
    current_user: dict = Depends(get_current_user)
):
    """
    Forward a message to a DM conversation.
    source_type: 'channel' for channel messages, 'dm' for direct messages
    """
    from app.services.message_service import MessageService
    from app.services.server_service import MemberService, ChannelService, ServerService
    
    # Check if they are friends
    are_friends = await FriendService.are_friends(current_user["_id"], friend_id)
    if not are_friends:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only forward messages to friends"
        )
    
    source_server_name = None
    
    if source_type == "channel":
        # Get source message from channel messages
        source_message = await MessageService.get_message_by_id(source_message_id)
        if not source_message:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Source message not found"
            )
        
        # Verify user has access to source channel
        source_channel = await ChannelService.get_channel_by_id(source_message["channel_id"])
        if source_channel:
            source_member = await MemberService.get_member(source_channel["server_id"], current_user["_id"])
            if not source_member:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You don't have access to the source message"
                )
            # Get server name
            source_server = await ServerService.get_server_by_id(source_channel["server_id"])
            if source_server:
                source_server_name = source_server.get("name")
    else:
        # Get source message from DMs
        source_message = await DirectMessageService.get_message_by_id(source_message_id)
        if not source_message:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Source message not found"
            )
        
        # Verify user is part of the DM conversation
        if source_message["sender_id"] != current_user["_id"] and source_message["receiver_id"] != current_user["_id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to the source message"
            )
    
    # Create forwarded DM message
    forwarded_message = await DirectMessageService.send_message(
        sender_id=current_user["_id"],
        receiver_id=friend_id,
        content=source_message.get("content", ""),
        attachments=source_message.get("attachments", []),
        is_forwarded=True,
        forward_origin_id=source_message_id,
        forward_server_name=source_server_name
    )

    # Add Socket Emission for Forwarding (Similar fix)
    try:
        from app.socket_instance import sio
        socket_payload = {
            "_id": str(forwarded_message["_id"]),
            "content": forwarded_message.get("content"),
            "sender_id": str(forwarded_message["sender_id"]),
            "receiver_id": str(forwarded_message["receiver_id"]),
            "timestamp": str(forwarded_message["timestamp"]),
            "attachments": forwarded_message.get("attachments", []),
            "is_forwarded": True,
            "sender": {
                "username": current_user.get("username"),
                "avatar_url": current_user.get("avatar_url"),
                "_id": str(current_user["_id"])
            }
        }
        await sio.emit("dm_new_message", socket_payload, room=str(friend_id), namespace="/chat")
        await sio.emit("dm_new_message", socket_payload, room=str(current_user["_id"]), namespace="/chat")
    except Exception as e:
        print(f"Forward Socket Error: {e}")
    
    return {"message": "Message forwarded", "dm": forwarded_message}


@router.put("/message/{message_id}/pin")
async def pin_message(
    message_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Pin a direct message"""
    message = await DirectMessageService.get_message_by_id(message_id)
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )
        
    # Verify participant
    if message["sender_id"] != current_user["_id"] and message["receiver_id"] != current_user["_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not part of this conversation"
        )
        
    updated_message = await DirectMessageService.pin_message(message_id)
    if not updated_message:
        raise HTTPException(status_code=500, detail="Failed to pin message")
        
    # Socket update
    try:
        from app.socket_instance import sio
        
        sender_id = message["sender_id"]
        receiver_id = message["receiver_id"]
        
        # Prepare payload
        socket_payload = updated_message.copy()
        socket_payload["_id"] = str(socket_payload["_id"])
        socket_payload["sender_id"] = str(socket_payload["sender_id"])
        socket_payload["receiver_id"] = str(socket_payload["receiver_id"])
        if "timestamp" in socket_payload:
            socket_payload["timestamp"] = str(socket_payload["timestamp"])
        
        # Emit to both users (using ID based rooms as agreed)
        await sio.emit("dm_updated", socket_payload, room=str(sender_id), namespace="/chat")
        await sio.emit("dm_updated", socket_payload, room=str(receiver_id), namespace="/chat")
    except Exception as e:
        print(f"Pin Socket Error: {e}")
    
    return {"message": "Message pinned", "dm": updated_message}


@router.put("/message/{message_id}/unpin")
async def unpin_message(
    message_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Unpin a direct message"""
    message = await DirectMessageService.get_message_by_id(message_id)
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )
        
    # Verify participant
    if message["sender_id"] != current_user["_id"] and message["receiver_id"] != current_user["_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not part of this conversation"
        )
        
    updated_message = await DirectMessageService.unpin_message(message_id)
    if not updated_message:
        raise HTTPException(status_code=500, detail="Failed to unpin message")
        
    try:
        from app.socket_instance import sio
        
        sender_id = message["sender_id"]
        receiver_id = message["receiver_id"]
        
        # Prepare payload
        socket_payload = updated_message.copy()
        socket_payload["_id"] = str(socket_payload["_id"])
        socket_payload["sender_id"] = str(socket_payload["sender_id"])
        socket_payload["receiver_id"] = str(socket_payload["receiver_id"])
        if "timestamp" in socket_payload:
            socket_payload["timestamp"] = str(socket_payload["timestamp"])
        
        await sio.emit("dm_updated", socket_payload, room=str(sender_id), namespace="/chat")
        await sio.emit("dm_updated", socket_payload, room=str(receiver_id), namespace="/chat")
    except Exception as e:
        print(f"Unpin Socket Error: {e}")
    
    return {"message": "Message unpinned", "dm": updated_message}


@router.get("/{friend_id}/pins")
async def get_pinned_messages(
    friend_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get pinned messages with a friend"""
    # Check if friends
    are_friends = await FriendService.are_friends(current_user["_id"], friend_id)
    if not are_friends:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not friends with this user"
        )
        
    pins = await DirectMessageService.get_pinned_messages(current_user["_id"], friend_id)
    
    # Populate sender details manually
    users_collection = get_users_collection()
    
    for pin in pins:
        if "sender_id" in pin:
            try:
                user = await users_collection.find_one({"_id": ObjectId(pin["sender_id"])})
                if user:
                    sender_info = {
                        "username": user.get("username"),
                        "avatar_url": user.get("avatar_url"),
                        "display_name": user.get("display_name"),
                        "_id": str(user["_id"])
                    }
                    
                    # Attach sender object as requested
                    pin["sender"] = sender_info
                    
                    # Also attach flattened fields for frontend compatibility
                    pin["sender_username"] = user.get("username")
                    pin["sender_display_name"] = user.get("display_name")
                    pin["sender_avatar_url"] = user.get("avatar_url")
            except Exception as e:
                print(f"Error populating user for DM pin {pin.get('_id')}: {e}")
                
    return {"messages": pins}