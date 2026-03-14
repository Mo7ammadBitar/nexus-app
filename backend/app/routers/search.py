"""
Search Router
"""
from fastapi import APIRouter, HTTPException, status, Depends, Query
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field
from bson import ObjectId

from app.middleware.auth import get_current_user
from app.database import (
    get_messages_collection,
    get_direct_messages_collection,
    get_members_collection,
    get_channels_collection,
    get_users_collection,
    get_servers_collection,
    get_friends_collection 
)

router = APIRouter(prefix="/search", tags=["Search"])

class SearchResultSender(BaseModel):
    id: str
    username: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None

class SearchResultLocation(BaseModel):
    server_id: Optional[str] = None
    server_name: Optional[str] = None
    channel_id: Optional[str] = None
    channel_name: Optional[str] = None
    friend_id: Optional[str] = None
    friend_username: Optional[str] = None

class SearchResult(BaseModel):
    type: str  # "channel" or "dm"
    message_id: str
    content: str
    timestamp: datetime
    sender: SearchResultSender
    location: SearchResultLocation

@router.get("", response_model=dict)
async def global_search(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(default=20, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    """
    Global search for messages across servers and DMs.
    """
    if not q.strip():
         return {"results": []}

    user_id = current_user["_id"]
    results = []

    # Requires case-insensitive regex search
    regex_query = {"$regex": q, "$options": "i"}

    # 1. Search in Servers (Channel Messages)
    # First, find distinct servers/channels user has access to
    members_collection = get_members_collection()
    channels_collection = get_channels_collection()
    messages_collection = get_messages_collection()
    servers_collection = get_servers_collection()
    users_collection = get_users_collection()

    # Get all servers user is a member of
    user_memberships = await members_collection.find({"user_id": user_id}).to_list(None)
    server_ids = [m["server_id"] for m in user_memberships]

    if server_ids:
        # Get all channels in these servers
        # We might want to filter by permission in the future, but for now assuming member access = read access
        user_channels = await channels_collection.find({"server_id": {"$in": server_ids}}).to_list(None)
        
        # Create a map for quick access
        channel_map = {c["_id"]: c for c in user_channels}
        channel_ids = list(channel_map.keys())

        # Also get server details for names
        user_servers = await servers_collection.find({"_id": {"$in": server_ids}}).to_list(None)
        server_map = {s["_id"]: s for s in user_servers}

        if channel_ids:
            server_messages = await messages_collection.find({
                "channel_id": {"$in": channel_ids},
                "content": regex_query
            }).sort("timestamp", -1).limit(limit).to_list(limit)

            # Enrich results
            for msg in server_messages:
                channel = channel_map.get(msg["channel_id"])
                if not channel: continue
                
                server = server_map.get(channel["server_id"])
                if not server: continue

                # Get sender info (ideally cached or joined, but doing simple fetch for now if missing)
                # Get sender info (ideally cached or joined, but doing simple fetch for now if missing)
                sender_id = msg["user_id"]
                try:
                    sender = await users_collection.find_one({"_id": ObjectId(str(sender_id))})
                except:
                    sender = None
                
                results.append(SearchResult(
                    type="channel",
                    message_id=str(msg["_id"]),
                    content=msg.get("content", "") or (f"[{msg['attachments'][0]['type']}]" if msg.get("attachments") else ""),
                    timestamp=msg["timestamp"],
                    sender=SearchResultSender(
                        id=str(sender_id),
                        username=sender["username"] if sender else "Unknown",
                        display_name=sender.get("display_name") if sender else None,
                        avatar_url=sender.get("avatar_url") if sender else None
                    ),
                    location=SearchResultLocation(
                        server_id=str(server["_id"]),
                        server_name=server["name"],
                        channel_id=str(channel["_id"]),
                        channel_name=channel["name"]
                    )
                ))

    # 2. Search in Direct Messages
    dm_collection = get_direct_messages_collection()
    
    dm_messages = await dm_collection.find({
        "$or": [{"sender_id": user_id}, {"receiver_id": user_id}],
        "content": regex_query
    }).sort("timestamp", -1).limit(limit).to_list(limit)

    for msg in dm_messages:
        # Determine the "Friend" (the other person in the conversation)
        is_sender = msg["sender_id"] == user_id
        friend_id = msg["receiver_id"] if is_sender else msg["sender_id"]
        
        # Determine who sent the message
        sender_id = msg["sender_id"]
        
        # Fetch needed user info
        try:
            sender = await users_collection.find_one({"_id": ObjectId(str(sender_id))})
            friend = await users_collection.find_one({"_id": ObjectId(str(friend_id))}) # Need friend info for navigation context
        except:
            sender = None
            friend = None
        
        results.append(SearchResult(
            type="dm",
            message_id=str(msg["_id"]),
            content=msg.get("content", "") or (f"[{msg['attachments'][0]['type']}]" if msg.get("attachments") else ""),
            timestamp=msg["timestamp"],
            sender=SearchResultSender(
                id=str(sender_id),
                username=sender["username"] if sender else "Unknown",
                display_name=sender.get("display_name") if sender else None,
                avatar_url=sender.get("avatar_url") if sender else None
            ),
            location=SearchResultLocation(
                friend_id=str(friend_id),
                friend_username=friend["username"] if friend else "Unknown"
            )
        ))

    # 3. Sort Combined Results
    results.sort(key=lambda x: x.timestamp, reverse=True)
    
    # 4. Limit Final Output
    final_results = results[:limit]

    return {"results": [r.dict() for r in final_results]}
