"""
Quests Routes - Nexus Quests Gamification System
Users complete tasks to earn Aether Shards.
"""
from fastapi import APIRouter, HTTPException, status, Depends
from datetime import datetime
from bson import ObjectId

from app.middleware.auth import get_current_user
from app.database import get_users_collection, get_quest_progress_collection

router = APIRouter(prefix="/quests", tags=["Quests"])


# ============ Quests Catalog (Hardcoded) ============

QUESTS_CATALOG = [
    {
        "id": "quest_send_100_messages",
        "name": "First Words",
        "description": "Send your first 100 messages across servers or DMs.",
        "reward_shards": 100,
        "is_repeatable": False,
        "icon": "MessageSquare",
        "requirement_type": "total_messages_sent",
        "requirement_value": 100,
        "category": "engagement"
    },
    {
        "id": "quest_send_500_messages",
        "name": "Chatterbox",
        "description": "Send 500 messages across any servers or DMs.",
        "reward_shards": 250,
        "is_repeatable": False,
        "icon": "MessagesSquare",
        "requirement_type": "total_messages_sent",
        "requirement_value": 500,
        "category": "engagement"
    },
    {
        "id": "quest_invite_3_friends",
        "name": "Social Butterfly",
        "description": "Invite 3 friends who join Nexus using your invite code.",
        "reward_shards": 500,
        "is_repeatable": False,
        "icon": "Users",
        "requirement_type": "total_invites_successful",
        "requirement_value": 3,
        "category": "growth"
    },
    {
        "id": "quest_upload_avatar",
        "name": "Identity Forged",
        "description": "Upload your first profile avatar.",
        "reward_shards": 75,
        "is_repeatable": False,
        "icon": "UserCircle",
        "requirement_type": "has_uploaded_avatar",
        "requirement_value": 1,
        "category": "profile"
    },
    {
        "id": "quest_daily_login",
        "name": "Daily Return",
        "description": "Log in to Nexus today. Repeatable every 24 hours.",
        "reward_shards": 20,
        "is_repeatable": True,
        "icon": "Sun",
        "requirement_type": "daily_login",
        "requirement_value": 1,
        "category": "retention"
    },
    {
        "id": "quest_react_50_times",
        "name": "Reactor",
        "description": "React to 50 messages with emojis.",
        "reward_shards": 100,
        "is_repeatable": False,
        "icon": "Zap",
        "requirement_type": "total_reactions_given",
        "requirement_value": 50,
        "category": "engagement"
    },
    {
        "id": "quest_join_3_servers",
        "name": "Explorer",
        "description": "Join 3 different servers.",
        "reward_shards": 150,
        "is_repeatable": False,
        "icon": "Compass",
        "requirement_type": "total_servers_joined",
        "requirement_value": 3,
        "category": "growth"
    },
]


def _get_user_stat(user: dict, requirement_type: str) -> int:
    """Get the user stat value for a given requirement type."""
    if requirement_type == "has_uploaded_avatar":
        return 1 if user.get("has_uploaded_avatar", False) else 0
    elif requirement_type == "daily_login":
        # Daily login is always met if user is logged in — progress tracked via claim
        return 1
    else:
        return user.get(requirement_type, 0) or 0


@router.get("")
async def get_quests(current_user: dict = Depends(get_current_user)):
    """
    Return full quest catalog with user progress for each quest.
    """
    user_id = current_user["_id"]
    quest_progress = get_quest_progress_collection()

    # Fetch all progress records for this user
    progress_map = {}
    async for doc in quest_progress.find({"user_id": user_id}):
        progress_map[doc["quest_id"]] = doc

    quests = []
    for quest in QUESTS_CATALOG:
        progress = progress_map.get(quest["id"])

        # Calculate current progress from user stats
        current_progress = _get_user_stat(current_user, quest["requirement_type"])

        # Check if completed
        is_completed = current_progress >= quest["requirement_value"]

        # Check if claimed
        claimed = False
        if progress:
            claimed = progress.get("claimed", False)

        # For repeatable quests, check if enough time has passed since last claim
        if quest["is_repeatable"] and claimed:
            last_claimed = progress.get("claimed_at")
            if last_claimed:
                elapsed = (datetime.utcnow() - last_claimed).total_seconds()
                if elapsed >= 86400:  # 24 hours
                    claimed = False  # Allow re-claim

        quests.append({
            "id": quest["id"],
            "name": quest["name"],
            "description": quest["description"],
            "reward_shards": quest["reward_shards"],
            "is_repeatable": quest["is_repeatable"],
            "icon": quest["icon"],
            "category": quest["category"],
            "requirement_type": quest["requirement_type"],
            "requirement_value": quest["requirement_value"],
            "current_progress": min(current_progress, quest["requirement_value"]),
            "is_completed": is_completed,
            "claimed": claimed,
        })

    return {"quests": quests}


@router.post("/{quest_id}/claim")
async def claim_quest(quest_id: str, current_user: dict = Depends(get_current_user)):
    """
    Claim reward shards for a completed quest.
    """
    user_id = current_user["_id"]

    # Find quest in catalog
    quest = next((q for q in QUESTS_CATALOG if q["id"] == quest_id), None)
    if not quest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quest not found."
        )

    # Check if user meets the requirement
    current_progress = _get_user_stat(current_user, quest["requirement_type"])
    if current_progress < quest["requirement_value"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Quest not completed. Progress: {current_progress}/{quest['requirement_value']}"
        )

    from datetime import timedelta
    quest_progress = get_quest_progress_collection()
    now = datetime.utcnow()

    # 1. Ensure document exists so we can atomically check 'claimed'
    await quest_progress.update_one(
        {"user_id": user_id, "quest_id": quest_id},
        {"$setOnInsert": {"claimed": False, "user_id": user_id, "quest_id": quest_id}},
        upsert=True
    )

    # 2. Atomic claim update
    cutoff = now - timedelta(hours=24)
    query = {"user_id": user_id, "quest_id": quest_id}
    
    if not quest["is_repeatable"]:
        query["claimed"] = False
    else:
        query["$or"] = [
            {"claimed": False},
            {"claimed_at": {"$lt": cutoff}}
        ]

    result = await quest_progress.update_one(
        query,
        {
            "$set": {
                "current_progress": current_progress,
                "is_completed": True,
                "claimed": True,
                "completed_at": now,
                "claimed_at": now,
            }
        }
    )

    if result.modified_count == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Quest reward already claimed or on cooldown."
        )

    # Award shards atomically
    users = get_users_collection()
    await users.update_one(
        {"_id": ObjectId(user_id)},
        {
            "$inc": {"aether_shards": quest["reward_shards"]},
            "$set": {"updated_at": now}
        }
    )

    # Approximate for return display since it was an atomic inc
    new_balance = current_user.get("aether_shards", 0) + quest["reward_shards"]

    return {
        "message": f"+{quest['reward_shards']} Aether Shards earned from '{quest['name']}'!",
        "shards_earned": quest["reward_shards"],
        "new_balance": new_balance,
        "quest_id": quest_id
    }
