from fastapi import APIRouter, Depends, HTTPException, status
from app.database import get_users_collection
from app.middleware.auth import get_current_user
from app.models.user import UserInDB as User
from pydantic import BaseModel
from datetime import datetime, timedelta

router = APIRouter(prefix="/payments", tags=["payments"])

# Mock Payment Config
SHARD_PACKS = {
    "pack_small": {"shards": 100, "price": 0.99},
    "pack_medium": {"shards": 550, "price": 4.99},
    "pack_large": {"shards": 1200, "price": 9.99}
}

# Subscription durations
PLAN_DURATIONS = {
    "monthly": timedelta(days=30),
    "yearly": timedelta(days=365),
}

class BuyShardsRequest(BaseModel):
    pack_id: str

class SubscribeRequest(BaseModel):
    plan: str  # "monthly" or "yearly"

from bson import ObjectId

@router.post("/buy-shards")
async def buy_shards(request: BuyShardsRequest, current_user: dict = Depends(get_current_user)):
    """
    Mock endpoint to purchase shards.
    """
    if request.pack_id not in SHARD_PACKS:
        raise HTTPException(status_code=400, detail="Invalid pack ID")
    
    pack = SHARD_PACKS[request.pack_id]
    amount = pack["shards"]
    
    users = get_users_collection()
    
    # Update user shards
    result = await users.find_one_and_update(
        {"_id": ObjectId(current_user["_id"])},
        {"$inc": {"aether_shards": amount}},
        return_document=True
    )
    
    return {
        "status": "success",
        "message": f"Successfully purchased {amount} Shards!",
        "new_balance": result["aether_shards"],
        "shards_added": amount
    }

@router.post("/subscribe")
async def subscribe_nexus_elite(request: SubscribeRequest, current_user: dict = Depends(get_current_user)):
    """
    Mock endpoint to subscribe to Nexus Elite.
    """
    if request.plan not in ["monthly", "yearly"]:
        raise HTTPException(status_code=400, detail="Invalid plan")
    
    users = get_users_collection()
    
    now = datetime.utcnow()
    expires_at = now + PLAN_DURATIONS[request.plan]
    
    # Activate Premium with expiration
    result = await users.find_one_and_update(
        {"_id": ObjectId(current_user["_id"])},
        {
            "$set": {
                "is_premium": True,
                "premium_plan": request.plan,
                "premium_since": now,
                "premium_expires_at": expires_at,
            }
        },
        return_document=True
    )
    
    return {
        "status": "success",
        "message": "Welcome to Nexus Elite! All features unlocked.",
        "is_premium": True,
        "plan": request.plan,
        "premium_expires_at": expires_at.isoformat()
    }
