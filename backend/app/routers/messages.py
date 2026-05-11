"""
Messages Routes - Channel Messages with File Upload
"""
from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File, Query, Form, Body
from pydantic import BaseModel
from typing import Optional, List
import os
import uuid
import aiofiles
import traceback
from datetime import datetime
from bson import ObjectId
from app.database import get_users_collection
from app.socket_instance import sio

from app.middleware.auth import get_current_user
from app.services.message_service import MessageService
from app.services.server_service import MemberService, ChannelService
from app.config import get_settings

settings = get_settings()
router = APIRouter(prefix="/messages", tags=["Messages"])


def _serialize_message(data):
    """Recursively convert ObjectId and datetime values to strings for JSON serialization."""
    if isinstance(data, list):
        return [_serialize_message(item) for item in data]
    if isinstance(data, dict):
        result = {}
        for k, v in data.items():
            if isinstance(v, ObjectId):
                result[k] = str(v)
            elif isinstance(v, datetime):
                result[k] = v.isoformat()
            elif isinstance(v, (dict, list)):
                result[k] = _serialize_message(v)
            else:
                result[k] = v
        return result
    if isinstance(data, ObjectId):
        return str(data)
    if isinstance(data, datetime):
        return data.isoformat()
    return data


# Pydantic models for request bodies
class PinRequest(BaseModel):
    is_pinned: bool = True  # Default to True for pin, False for unpin

# Allowed file types
ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]
ALLOWED_AUDIO_TYPES = [
    "audio/mpeg", "audio/wav", "audio/ogg", "audio/webm",
    "audio/m4a", "audio/mp4", "audio/x-m4a", "audio/aac"  # Voice message formats
]
ALLOWED_DOCUMENT_TYPES = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",  # docx
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",  # pptx
    "text/plain",  # txt
]
ALLOWED_ARCHIVE_TYPES = [
    "application/zip",
    "application/x-rar-compressed",
    "application/vnd.rar",
]
ALLOWED_FILE_TYPES = ALLOWED_IMAGE_TYPES + ALLOWED_AUDIO_TYPES + ALLOWED_DOCUMENT_TYPES + ALLOWED_ARCHIVE_TYPES


@router.get("/{channel_id}")
async def get_messages(
    channel_id: str,
    limit: int = Query(50, ge=1, le=100),
    before_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Get messages from a channel.
    Supports pagination using before_id.
    """
    # Verify channel exists and user has access
    channel = await ChannelService.get_channel_by_id(channel_id)
    if not channel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Channel not found"
        )
    
    member = await MemberService.get_member(channel["server_id"], current_user["_id"])
    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this server"
        )
    
    messages = await MessageService.get_channel_messages(channel_id, limit, before_id)
    return {"messages": messages}


@router.post("/{channel_id}")
async def send_message(
    channel_id: str,
    content: Optional[str] = Form(None),
    reply_to_id: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    message_type: Optional[str] = Form(None),  # "voice" for voice messages
    duration: Optional[float] = Form(None),     # Duration in seconds for voice
    current_user: dict = Depends(get_current_user)
):
    """
    Send a message to a channel with optional file attachment.
    Supports images, audio recordings, and PDFs.
    """
    # Verify channel and membership
    channel = await ChannelService.get_channel_by_id(channel_id)
    if not channel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Channel not found"
        )
        
    if not content and not file:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message content or file is required"
        )
    
    # Check if it's a text channel
    if channel["type"] != "text":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only send messages to text channels"
        )
    
    member = await MemberService.get_member(channel["server_id"], current_user["_id"])
    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this server"
        )
    
    # Check if muted
    if member.get("is_muted"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You are muted. Reason: {member.get('mute_reason', 'No reason provided')}"
        )
    
    # Check channel send permission
    send_permission = channel.get("send_permission", "all")
    if send_permission == "mods_only" and member["role"] not in ["owner", "moderator"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only moderators and owner can send messages in this channel"
        )
    
    # Check timeout
    from datetime import datetime, timezone
    if member.get("timeout_until"):
        timeout_until = member["timeout_until"]
        if isinstance(timeout_until, str):
            timeout_until = datetime.fromisoformat(timeout_until.replace('Z', '+00:00'))
        
        # Ensure timeout_until is offset-naive for comparison, since datetime.utcnow() is naive
        if timeout_until.tzinfo is not None:
             timeout_until = timeout_until.replace(tzinfo=None)
             
        if timeout_until > datetime.utcnow():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"You are timed out by Nexus Sentinel."
            )

    # ------------------ NEXUS SENTINEL CHECK ------------------
    from app.services.server_service import ServerService
    server = await ServerService.get_server_by_id(channel["server_id"])
    if server and server.get("sentinel_settings", {}).get("is_enabled") and member["role"] not in ["owner", "moderator"]:
        sentinel = server["sentinel_settings"]
        is_violation = False
        violation_reason = ""
        
        # 1. Anti-Links Match
        if sentinel.get("anti_links") and content:
            import re
            if re.search(r"https?://", content, re.IGNORECASE):
                is_violation = True
                violation_reason = "Posting links is not allowed"

        # 2. Banned Words Match
        if not is_violation and content and sentinel.get("banned_words"):
            content_lower = content.lower()
            for word in sentinel.get("banned_words"):
                if word.strip() and word.strip().lower() in content_lower:
                    is_violation = True
                    violation_reason = f"Usage of banned word: {word}"
                    break
        
        # 3. Anti-Spam (5 messages in 5 seconds)
        if not is_violation and sentinel.get("anti_spam"):
            from datetime import timedelta
            from app.database import get_messages_collection
            messages_col = get_messages_collection()
            five_sec_ago = datetime.utcnow() - timedelta(seconds=5)
            recent_msgs = await messages_col.count_documents({
                "channel_id": channel_id,
                "user_id": current_user["_id"],
                "timestamp": {"$gt": five_sec_ago}
            })
            if recent_msgs >= 5:
                is_violation = True
                violation_reason = "Triggered anti-spam limit"

        if is_violation:
            from datetime import timedelta
            from app.database import get_members_collection, get_database
            
            members_col = get_members_collection()
            new_strikes = member.get("strikes", 0) + 1
            
            update_data = {"$set": {"strikes": new_strikes}}
            
            new_timeout_until = None
            if new_strikes >= 2:
                new_timeout_until = datetime.utcnow() + timedelta(minutes=10)
                update_data["$set"]["timeout_until"] = new_timeout_until
                
            await members_col.update_one(
                {"server_id": channel["server_id"], "user_id": current_user["_id"]},
                update_data
            )
            
            # Audit log
            db = get_database()
            audit_col = db["audit_logs"]
            
            await audit_col.insert_one({
                "server_id": channel["server_id"],
                "action": "sentinel_auto_mod",
                "user_id": current_user["_id"],
                "reason": violation_reason,
                "created_at": datetime.utcnow()
            })
            
            from app.socket_instance import sio
            if new_strikes == 1:
                # Warning
                await sio.emit("sentinel_warning", {
                    "reason": violation_reason,
                    "channel_id": channel_id,
                    "server_id": channel["server_id"]
                }, room=str(current_user["_id"]), namespace="/chat")
            elif new_strikes >= 2:
                # Timeout
                await sio.emit("sentinel_timeout", {
                    "reason": violation_reason,
                    "until": new_timeout_until.isoformat(),
                    "channel_id": channel_id,
                    "server_id": channel["server_id"]
                }, room=str(current_user["_id"]), namespace="/chat")

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Sentinel Blocked: {violation_reason}. Current strikes: {new_strikes}"
            )
    # ------------------------------------------------------------
    
    # Process attachment
    attachments = []
    if file and file.filename:
        # Check file type
        ext = file.filename.split(".")[-1].lower() if file.filename else ""
        allowed_extensions = ["docx", "pdf", "pptx", "jpg", "jpeg", "png", "gif", "txt", "zip", "rar"]

        if file.content_type not in ALLOWED_FILE_TYPES and ext not in allowed_extensions:
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
        # Check if this is a voice message
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
            secure_url = await upload_file(file, folder=f"messages/{subdir}")
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
        
        # Add metadata for voice messages
        if file_type == "voice" and duration is not None:
            attachment_data["metadata"] = {
                "duration": duration
            }
        
        attachments.append(attachment_data)
    
    # Create message
    message = await MessageService.create_message(
        channel_id=channel_id,
        user_id=current_user["_id"],
        content=content,
        attachments=attachments,
        reply_to_id=reply_to_id
    )
    
    # Add user info
    # Add user info
    message["username"] = current_user["username"]
    message["display_name"] = current_user.get("display_name")
    message["avatar_url"] = current_user.get("avatar_url")
    
    # Broadcast the new message to the channel room
    room = f"channel_{channel_id}"
    
    # Serialize the entire message (converts datetime, ObjectId, and nested structures)
    safe_message = _serialize_message(message)
        
    await sio.emit("new_message", safe_message, room=room, namespace="/chat")
    
    # Quest: increment total_messages_sent
    try:
        users_col = get_users_collection()
        await users_col.update_one(
            {"_id": ObjectId(current_user["_id"])},
            {"$inc": {"total_messages_sent": 1}}
        )
    except Exception:
        pass  # Non-critical
    
    return {"message": "Message sent", "data": safe_message}


@router.post("/forward/{target_channel_id}")
async def forward_message(
    target_channel_id: str,
    source_message_id: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Forward a message to a channel.
    """
    from app.services.server_service import ServerService
    
    # Verify source message exists
    source_message = await MessageService.get_message_by_id(source_message_id)
    if not source_message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Source message not found"
        )
    
    # Get source channel to verify user can read it
    source_channel = await ChannelService.get_channel_by_id(source_message["channel_id"])
    if source_channel:
        source_member = await MemberService.get_member(source_channel["server_id"], current_user["_id"])
        if not source_member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to the source message"
            )
    
    # Verify target channel exists and user has access
    target_channel = await ChannelService.get_channel_by_id(target_channel_id)
    if not target_channel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target channel not found"
        )
    
    target_member = await MemberService.get_member(target_channel["server_id"], current_user["_id"])
    if not target_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of the target server"
        )
    
    # Check if muted in target server
    if target_member.get("is_muted"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You are muted in the target server"
        )
    
    # Get source server name for display
    source_server_name = None
    if source_channel:
        source_server = await ServerService.get_server_by_id(source_channel["server_id"])
        if source_server:
            source_server_name = source_server.get("name")
    
    # Forward the message
    forwarded_message = await MessageService.forward_message(
        source_message_id=source_message_id,
        target_channel_id=target_channel_id,
        user_id=current_user["_id"],
        source_server_name=source_server_name
    )
    
    if not forwarded_message:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to forward message"
        )
    
    # Broadcast the new message (serialize to prevent datetime/ObjectId crash)
    room = f"channel_{target_channel_id}"
    safe_forwarded = _serialize_message(forwarded_message)
    await sio.emit("new_message", safe_forwarded, room=room, namespace="/chat")
    
    return {"message": "Message forwarded", "data": safe_forwarded}


# REACTION ENDPOINTS - Must be defined before /{channel_id}/{message_id} routes
# Otherwise FastAPI will match 'react' as a message_id

@router.post("/{message_id}/react")
async def add_reaction(
    message_id: str,
    emoji: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    """Add a reaction to a message."""
    message = await MessageService.get_message_by_id(message_id)
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )
    
    channel = await ChannelService.get_channel_by_id(message["channel_id"])
    if not channel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Channel not found"
        )
    
    member = await MemberService.get_member(channel["server_id"], current_user["_id"])
    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this server"
        )
    
    result = await MessageService.add_reaction(message_id, current_user["_id"], emoji)
    
    # Broadcast reaction update
    room = f"channel_{message['channel_id']}"
    await sio.emit("message_updated", {
        "message_id": message_id,
        "reactions": result.get("reactions", {})
    }, room=room, namespace="/chat")

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


@router.delete("/{message_id}/react")
async def remove_reaction(
    message_id: str,
    emoji: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Remove a reaction from a message."""
    message = await MessageService.get_message_by_id(message_id)
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )
    
    channel = await ChannelService.get_channel_by_id(message["channel_id"])
    if not channel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Channel not found"
        )
    
    member = await MemberService.get_member(channel["server_id"], current_user["_id"])
    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this server"
        )
    
    result = await MessageService.remove_reaction(message_id, current_user["_id"], emoji)
    
    # Broadcast reaction update
    room = f"channel_{message['channel_id']}"
    await sio.emit("message_updated", {
        "message_id": message_id,
        "reactions": result.get("reactions", {}) if result else {}
    }, room=room, namespace="/chat")
    
    return {"message": "Reaction removed", "reactions": result.get("reactions", {}) if result else {}}


# PIN/UNPIN ENDPOINTS - Must be defined before /{channel_id}/{message_id} routes
# Otherwise FastAPI will match 'pin'/'unpin' as a message_id

@router.put("/{message_id}/pin")
async def pin_message(
    message_id: str,
    request: PinRequest = Body(default=PinRequest(is_pinned=True)),
    current_user: dict = Depends(get_current_user)
):
    """Pin a message"""
    try:
        print(f"[PIN] Attempting to pin message: {message_id}")
        
        message = await MessageService.get_message_by_id(message_id)
        if not message:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Message not found"
            )
            
        channel = await ChannelService.get_channel_by_id(message["channel_id"])
        if not channel:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Channel not found"
            )
            
        # Check permission (Server Owner or Moderator)
        member = await MemberService.get_member(channel["server_id"], current_user["_id"])
        if not member or member["role"] not in ["owner", "moderator"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only moderators and owners can pin messages"
            )
            
        updated_message = await MessageService.pin_message(message_id)
        if not updated_message:
            raise HTTPException(status_code=500, detail="Failed to pin message - service returned None")
        
        # Serialize for JSON safety (converts datetime, ObjectId, etc.)
        safe_pinned = _serialize_message(updated_message)
            
        # Broadcast update
        room = f"channel_{message['channel_id']}"
        await sio.emit("message_updated", safe_pinned, room=room, namespace="/chat")
        
        print(f"[PIN] Successfully pinned message: {message_id}")
        return {"message": "Message pinned", "data": safe_pinned}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"ERROR PINNING: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{message_id}/unpin")
async def unpin_message(
    message_id: str,
    request: PinRequest = Body(default=PinRequest(is_pinned=False)),
    current_user: dict = Depends(get_current_user)
):
    """Unpin a message"""
    try:
        print(f"[UNPIN] Attempting to unpin message: {message_id}")
        
        message = await MessageService.get_message_by_id(message_id)
        if not message:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Message not found"
            )
            
        channel = await ChannelService.get_channel_by_id(message["channel_id"])
        if not channel:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Channel not found"
            )
            
        # Check permission (Server Owner or Moderator)
        member = await MemberService.get_member(channel["server_id"], current_user["_id"])
        if not member or member["role"] not in ["owner", "moderator"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only moderators and owners can unpin messages"
            )
            
        updated_message = await MessageService.unpin_message(message_id)
        if not updated_message:
            raise HTTPException(status_code=500, detail="Failed to unpin message - service returned None")
        
        # Serialize for JSON safety (converts datetime, ObjectId, etc.)
        safe_unpinned = _serialize_message(updated_message)
            
        # Broadcast update
        room = f"channel_{message['channel_id']}"
        await sio.emit("message_updated", safe_unpinned, room=room, namespace="/chat")
        
        print(f"[UNPIN] Successfully unpinned message: {message_id}")
        return {"message": "Message unpinned", "data": safe_unpinned}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"ERROR UNPINNING: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{channel_id}/{message_id}")
async def delete_message(
    channel_id: str,
    message_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete a message (own message or moderator/owner).
    """
    message = await MessageService.get_message_by_id(message_id)
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )
    
    if message["channel_id"] != channel_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message does not belong to this channel"
        )
    
    channel = await ChannelService.get_channel_by_id(channel_id)
    if not channel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Channel not found"
        )
    
    member = await MemberService.get_member(channel["server_id"], current_user["_id"])
    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this server"
        )
    
    # Check permission (own message or moderator/owner)
    is_own_message = message["user_id"] == current_user["_id"]
    is_mod_or_owner = member["role"] in ["owner", "moderator"]
    
    if not is_own_message and not is_mod_or_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot delete this message"
        )
    
    await MessageService.delete_message(message_id)
    
    # Broadcast deletion
    room = f"channel_{channel_id}"
    await sio.emit("message_deleted", {
        "message_id": message_id,
        "channel_id": channel_id
    }, room=room, namespace="/chat")
    
    return {"message": "Message deleted"}


@router.put("/{channel_id}/{message_id}")
async def edit_message(
    channel_id: str,
    message_id: str,
    content: str = Form(..., min_length=1, max_length=2000),
    current_user: dict = Depends(get_current_user)
):
    """
    Edit a message (only the message author can edit).
    """
    message = await MessageService.get_message_by_id(message_id)
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )
    
    if message["channel_id"] != channel_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message does not belong to this channel"
        )
    
    # Only the message author can edit
    if message["user_id"] != current_user["_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only edit your own messages"
        )
    
    channel = await ChannelService.get_channel_by_id(channel_id)
    if not channel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Channel not found"
        )
    
    member = await MemberService.get_member(channel["server_id"], current_user["_id"])
    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this server"
        )
    
    # Update the message
    updated_message = await MessageService.update_message(message_id, content)
    
    if not updated_message:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update message"
        )
    
    # Add user info
    updated_message["username"] = current_user["username"]
    updated_message["display_name"] = current_user.get("display_name")
    updated_message["avatar_url"] = current_user.get("avatar_url")
    
    # Broadcast update (serialize to prevent datetime/ObjectId crash)
    room = f"channel_{channel_id}"
    safe_updated = _serialize_message(updated_message)
    await sio.emit("message_updated", safe_updated, room=room, namespace="/chat")
    
    return {"message": "Message updated", "data": safe_updated}


@router.get("/channel/{channel_id}/pins")
async def get_pinned_messages(
    channel_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all pinned messages for a channel"""
    channel = await ChannelService.get_channel_by_id(channel_id)
    if not channel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Channel not found"
        )
        
    # Check membership
    member = await MemberService.get_member(channel["server_id"], current_user["_id"])
    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this server"
        )
        
    pins = await MessageService.get_pinned_messages(channel_id)
    
    # Populate sender details manually
    users_collection = get_users_collection()
    
    for pin in pins:
        if "user_id" in pin:
            try:
                user = await users_collection.find_one({"_id": ObjectId(pin["user_id"])})
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
                    pin["username"] = user.get("username")
                    pin["display_name"] = user.get("display_name")
                    pin["avatar_url"] = user.get("avatar_url")
                    
                    # Frontend PinnedMessagesPanel expects author_ prefix for channel messages
                    pin["author_username"] = user.get("username")
                    pin["author_display_name"] = user.get("display_name")
                    pin["author_avatar_url"] = user.get("avatar_url")
            except Exception as e:
                print(f"Error populating user for pin {pin.get('_id')}: {e}")
                
    return {"messages": pins}

