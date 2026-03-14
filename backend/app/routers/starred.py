"""
Starred Messages Routes
"""
from fastapi import APIRouter, HTTPException, status, Depends
from typing import List
from datetime import datetime
from bson import ObjectId

from app.middleware.auth import get_current_user
from app.models.starred import MessageType, StarredMessageResponse
from app.database import (
    get_starred_messages_collection,
    get_messages_collection,
    get_direct_messages_collection,
    get_users_collection,
    get_servers_collection,
    get_channels_collection
)

router = APIRouter(prefix="/starred", tags=["Starred Messages"])


@router.post("/{message_type}/{message_id}")
async def star_message(
    message_type: MessageType,
    message_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Star a message.
    message_type: 'dm' or 'channel'
    """
    starred_collection = get_starred_messages_collection()
    user_id = str(current_user["_id"])
    
    # Check if already starred
    existing = await starred_collection.find_one({
        "user_id": user_id,
        "message_id": message_id
    })
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message already starred"
        )
    
    # Verify the message exists
    if message_type == MessageType.DM:
        dm_collection = get_direct_messages_collection()
        message = await dm_collection.find_one({"_id": ObjectId(message_id)})
        if not message:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Message not found"
            )
        # Verify user is part of this DM
        if user_id not in [message.get("sender_id"), message.get("receiver_id")]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this message"
            )
    else:
        messages_collection = get_messages_collection()
        message = await messages_collection.find_one({"_id": ObjectId(message_id)})
        if not message:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Message not found"
            )
    
    # Create starred message record
    starred_doc = {
        "user_id": user_id,
        "message_id": message_id,
        "message_type": message_type.value,
        "starred_at": datetime.utcnow()
    }
    
    await starred_collection.insert_one(starred_doc)
    
    return {"message": "Message starred successfully"}


@router.delete("/{message_id}")
async def unstar_message(
    message_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Unstar a message.
    """
    starred_collection = get_starred_messages_collection()
    user_id = str(current_user["_id"])
    
    result = await starred_collection.delete_one({
        "user_id": user_id,
        "message_id": message_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Starred message not found"
        )
    
    return {"message": "Message unstarred successfully"}


@router.get("", response_model=List[StarredMessageResponse])
async def get_starred_messages(
    current_user: dict = Depends(get_current_user)
):
    """
    Get all starred messages for the current user with source information.
    """
    starred_collection = get_starred_messages_collection()
    dm_collection = get_direct_messages_collection()
    messages_collection = get_messages_collection()
    users_collection = get_users_collection()
    servers_collection = get_servers_collection()
    channels_collection = get_channels_collection()
    
    user_id = str(current_user["_id"])
    
    # Get all starred messages for this user
    starred_cursor = starred_collection.find({"user_id": user_id}).sort("starred_at", -1)
    starred_list = await starred_cursor.to_list(length=100)
    
    result = []
    
    for starred in starred_list:
        message_id = starred["message_id"]
        message_type = starred["message_type"]
        
        try:
            if message_type == "dm":
                # Get DM message
                message = await dm_collection.find_one({"_id": ObjectId(message_id)})
                if not message:
                    continue
                
                # Get sender info
                sender = await users_collection.find_one({"_id": ObjectId(message["sender_id"])})
                
                # Determine friend (the other person in the DM)
                if message["sender_id"] == user_id:
                    friend_id = message["receiver_id"]
                else:
                    friend_id = message["sender_id"]
                
                friend = await users_collection.find_one({"_id": ObjectId(friend_id)})
                friend_name = friend.get("display_name") or friend.get("username", "Unknown") if friend else "Unknown"
                
                result.append({
                    "_id": str(starred["_id"]),
                    "message_id": message_id,
                    "message_type": message_type,
                    "starred_at": starred["starred_at"],
                    "content": message.get("content", ""),
                    "timestamp": message.get("timestamp"),
                    "attachments": message.get("attachments", []),
                    "sender_username": sender.get("username") if sender else None,
                    "sender_display_name": sender.get("display_name") if sender else None,
                    "sender_avatar_url": sender.get("avatar_url") if sender else None,
                    "source_name": f"DM with {friend_name}",
                    "source_type": "dm",
                    "friend_id": friend_id,
                    "server_id": None,
                    "server_name": None,
                    "channel_id": None,
                    "channel_name": None
                })
            else:
                # Get channel message
                message = await messages_collection.find_one({"_id": ObjectId(message_id)})
                if not message:
                    continue
                
                # Get sender info
                sender = await users_collection.find_one({"_id": ObjectId(message["user_id"])})
                
                # Get channel info
                channel = await channels_collection.find_one({"_id": ObjectId(message["channel_id"])})
                channel_name = channel.get("name", "Unknown") if channel else "Unknown"
                
                # Get server info
                server = None
                server_name = "Unknown"
                server_id = None
                if channel:
                    server_id = channel.get("server_id")
                    if server_id:
                        server = await servers_collection.find_one({"_id": ObjectId(server_id)})
                        server_name = server.get("name", "Unknown") if server else "Unknown"
                
                result.append({
                    "_id": str(starred["_id"]),
                    "message_id": message_id,
                    "message_type": message_type,
                    "starred_at": starred["starred_at"],
                    "content": message.get("content", ""),
                    "timestamp": message.get("timestamp"),
                    "attachments": message.get("attachments", []),
                    "sender_username": sender.get("username") if sender else None,
                    "sender_display_name": sender.get("display_name") if sender else None,
                    "sender_avatar_url": sender.get("avatar_url") if sender else None,
                    "source_name": f"{server_name} > #{channel_name}",
                    "source_type": "channel",
                    "friend_id": None,
                    "server_id": str(server_id) if server_id else None,
                    "server_name": server_name,
                    "channel_id": message["channel_id"],
                    "channel_name": channel_name
                })
        except Exception:
            # Skip invalid messages
            continue
    
    return result


@router.get("/check/{message_id}")
async def check_starred(
    message_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Check if a message is starred by the current user.
    """
    starred_collection = get_starred_messages_collection()
    user_id = str(current_user["_id"])
    
    existing = await starred_collection.find_one({
        "user_id": user_id,
        "message_id": message_id
    })
    
    return {"starred": existing is not None}
