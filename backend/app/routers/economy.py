"""
Economy Routes - Aether Shards & Rewarded Ad Claims
"""
from fastapi import APIRouter, HTTPException, status, Depends
from datetime import datetime, timedelta
from bson import ObjectId

from app.middleware.auth import get_current_user
from app.database import get_users_collection

router = APIRouter(prefix="/economy", tags=["Economy"])

# In-memory rate limiter: { user_id: last_claim_timestamp }
_claim_timestamps: dict = {}
CLAIM_COOLDOWN_SECONDS = 30
CLAIM_REWARD_AMOUNT = 50


@router.post("/claim-reward")
async def claim_reward(current_user: dict = Depends(get_current_user)):
    """
    Claim Aether Shards from watching a rewarded ad.
    Rate limited to 1 claim per 30 seconds per user.
    Awards +50 Aether Shards.
    """
    user_id = current_user["_id"]
    now = datetime.utcnow()

    # Rate limit check
    last_claim = _claim_timestamps.get(user_id)
    if last_claim:
        elapsed = (now - last_claim).total_seconds()
        if elapsed < CLAIM_COOLDOWN_SECONDS:
            remaining = int(CLAIM_COOLDOWN_SECONDS - elapsed)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"You must wait {remaining} seconds before claiming again."
            )

    # Update timestamp
    _claim_timestamps[user_id] = now

    # Add shards to user
    users = get_users_collection()
    current_shards = current_user.get("aether_shards", 0) or 0
    new_balance = current_shards + CLAIM_REWARD_AMOUNT

    await users.update_one(
        {"_id": ObjectId(user_id)},
        {
            "$set": {
                "aether_shards": new_balance,
                "updated_at": now
            }
        }
    )

    return {
        "message": f"+{CLAIM_REWARD_AMOUNT} Aether Shards claimed!",
        "shards_earned": CLAIM_REWARD_AMOUNT,
        "new_balance": new_balance
    }
