"""
Game Challenges Routes
Real-time game invitations between friends in DMs.
"""
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
from bson import ObjectId

from app.middleware.auth import get_current_user
from app.database import get_game_challenges_collection, get_users_collection, get_friends_collection
from app.socket_instance import sio

router = APIRouter(prefix="/games", tags=["Games"])

CHALLENGE_TTL_MINUTES = 5
VALID_GAME_TYPES = ["tic-tac-toe", "rps"]


# ── Schemas ──

class CreateChallengeRequest(BaseModel):
    opponent_id: str
    game_type: str  # "tic-tac-toe" | "rps"
    wager_text: Optional[str] = ""


# ── Helpers ──

def serialize_challenge(doc: dict) -> dict:
    """Convert MongoDB doc to JSON-safe dict."""
    if doc is None:
        return None
    doc["_id"] = str(doc["_id"])
    for key in ("created_at", "expires_at"):
        if key in doc and isinstance(doc[key], datetime):
            doc[key] = doc[key].isoformat()
    return doc


async def _check_friendship(user_id: str, friend_id: str) -> bool:
    """Verify two users are friends."""
    friends = get_friends_collection()
    friendship = await friends.find_one({
        "$or": [
            {"requester_id": user_id, "receiver_id": friend_id, "status": "accepted"},
            {"requester_id": friend_id, "receiver_id": user_id, "status": "accepted"},
        ]
    })
    return friendship is not None


# ── Endpoints ──

@router.post("/challenge")
async def create_challenge(
    body: CreateChallengeRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Send a game challenge to a friend.
    Creates a challenge document and emits a socket event to the opponent.
    """
    challenger_id = current_user["_id"]
    opponent_id = body.opponent_id

    # Validate not self-challenge
    if challenger_id == opponent_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot challenge yourself.",
        )

    # Validate game type
    if body.game_type not in VALID_GAME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid game type. Must be one of: {', '.join(VALID_GAME_TYPES)}",
        )

    # Validate opponent exists
    users = get_users_collection()
    opponent = await users.find_one({"_id": ObjectId(opponent_id)})
    if not opponent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Opponent not found.",
        )

    # Validate friendship
    is_friend = await _check_friendship(challenger_id, opponent_id)
    if not is_friend:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only challenge friends.",
        )

    # Check for existing pending challenge between these two users
    challenges = get_game_challenges_collection()
    existing = await challenges.find_one({
        "challenger_id": challenger_id,
        "opponent_id": opponent_id,
        "status": "pending",
        "expires_at": {"$gt": datetime.utcnow()},
    })
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have a pending challenge with this user.",
        )

    # Create challenge document
    now = datetime.utcnow()
    challenge_doc = {
        "challenger_id": challenger_id,
        "challenger_name": current_user.get("display_name") or current_user.get("username", "Unknown"),
        "opponent_id": opponent_id,
        "opponent_name": opponent.get("display_name") or opponent.get("username", "Unknown"),
        "game_type": body.game_type,
        "wager_text": body.wager_text or "",
        "status": "pending",
        "created_at": now,
        "expires_at": now + timedelta(minutes=CHALLENGE_TTL_MINUTES),
    }

    result = await challenges.insert_one(challenge_doc)
    challenge_doc["_id"] = result.inserted_id

    serialized = serialize_challenge(challenge_doc)

    # Emit socket event to opponent
    await sio.emit(
        "game:challenge_received",
        serialized,
        room=f"user_{opponent_id}",
        namespace="/chat",
    )

    return {"challenge": serialized}


@router.post("/challenge/{challenge_id}/accept")
async def accept_challenge(
    challenge_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Accept a pending game challenge."""
    challenges = get_game_challenges_collection()

    try:
        doc = await challenges.find_one({"_id": ObjectId(challenge_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid challenge ID.")

    if not doc:
        raise HTTPException(status_code=404, detail="Challenge not found.")

    # Must be the opponent
    if doc["opponent_id"] != current_user["_id"]:
        raise HTTPException(status_code=403, detail="Only the challenged user can accept.")

    # Must be pending
    if doc["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Challenge is already {doc['status']}.")

    # Must not be expired
    if doc["expires_at"] < datetime.utcnow():
        await challenges.update_one(
            {"_id": doc["_id"]},
            {"$set": {"status": "expired"}},
        )
        raise HTTPException(status_code=400, detail="Challenge has expired.")

    # Accept
    await challenges.update_one(
        {"_id": doc["_id"]},
        {"$set": {"status": "accepted"}},
    )
    doc["status"] = "accepted"
    serialized = serialize_challenge(doc)

    # Notify the challenger
    await sio.emit(
        "game:challenge_accepted",
        serialized,
        room=f"user_{doc['challenger_id']}",
        namespace="/chat",
    )

    return {"challenge": serialized}


@router.post("/challenge/{challenge_id}/decline")
async def decline_challenge(
    challenge_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Decline a pending game challenge."""
    challenges = get_game_challenges_collection()

    try:
        doc = await challenges.find_one({"_id": ObjectId(challenge_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid challenge ID.")

    if not doc:
        raise HTTPException(status_code=404, detail="Challenge not found.")

    # Must be the opponent
    if doc["opponent_id"] != current_user["_id"]:
        raise HTTPException(status_code=403, detail="Only the challenged user can decline.")

    # Must be pending
    if doc["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Challenge is already {doc['status']}.")

    # Decline
    await challenges.update_one(
        {"_id": doc["_id"]},
        {"$set": {"status": "declined"}},
    )
    doc["status"] = "declined"
    serialized = serialize_challenge(doc)

    # Notify the challenger
    await sio.emit(
        "game:challenge_declined",
        serialized,
        room=f"user_{doc['challenger_id']}",
        namespace="/chat",
    )

    return {"challenge": serialized}
