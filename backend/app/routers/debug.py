from fastapi import APIRouter, HTTPException
from app.database import get_users_collection, get_friends_collection, get_direct_messages_collection
from app.services.oracle_service import ORACLE_OID, ORACLE_ID
from datetime import datetime
from app.models.friend import FriendStatus

router = APIRouter(prefix="/debug", tags=["Debug & Repair"])

@router.get("/restore-oracle")
async def restore_oracle():
    """
    Emergency repair tool.
    1. Force-updates The Oracle's user document.
    2. Ensures The Oracle is in everyone's friend list.
    """
    users = get_users_collection()
    friends = get_friends_collection()
    
    # 1. Force Update Oracle
    oracle_data = {
        "username": "The Oracle",
        "email": "oracle@system.nexus",
        "display_name": "The Oracle",
        "role": "system",
        "avatar_url": "/static/2.jpg",
        "avatar_type": "static",
        "bio": "I guide Spirits through the Nexus. Ask me anything.",
        "is_premium": True,
        "is_online": True,
        "status": "online",
        "is_banned": False,
        "is_deleted": False,
        "is_system": True,
        "accent_color": "#A0A0A0",  # Metallic Grey
        "updated_at": datetime.utcnow(),
    }
    
    # Update or insert
    await users.update_one(
        {"_id": ORACLE_OID}, 
        {"$set": oracle_data}, 
        upsert=True
    )
    
    # 2. Add Oracle to EVERYONE'S friend list
    all_users = users.find({"_id": {"$ne": ORACLE_OID}})
    count = 0
    
    async for user in all_users:
        user_id = str(user["_id"])
        
        # Check if friendship exists
        existing_friendship = await friends.find_one({
            "$or": [
                {"requester_id": user_id, "receiver_id": ORACLE_ID},
                {"requester_id": ORACLE_ID, "receiver_id": user_id}
            ]
        })
        
        if not existing_friendship:
            # Create friendship (Oracle as requester, accepted immediately)
            friend_doc = {
                "requester_id": ORACLE_ID,  # Oracle adds you
                "receiver_id": user_id,
                "status": FriendStatus.ACCEPTED.value,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }
            await friends.insert_one(friend_doc)
            count += 1
            
    return {
        "status": "success",
        "message": f"Oracle restored. Added to {count} users' friend lists.",
        "oracle_oid": str(ORACLE_OID)
    }
