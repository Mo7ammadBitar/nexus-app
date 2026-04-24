"""
Game Challenges Routes — Unified Message Architecture
Challenges are stored as regular DM messages with type='game_challenge'
and a challenge_data JSON payload. This ensures:
  - Unread badge increments naturally
  - Challenge persists in chat history across reloads
  - Standard dm_new_message / dm_updated socket delivery
"""
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
from bson import ObjectId

from app.middleware.auth import get_current_user
from app.database import get_direct_messages_collection, get_users_collection, get_friends_collection
from app.socket_instance import sio

router = APIRouter(prefix="/games", tags=["Games"])

CHALLENGE_TTL_MINUTES = 5
VALID_GAME_TYPES = ["tic-tac-toe", "rps"]
GAME_LABELS = {"tic-tac-toe": "Tic-Tac-Toe", "rps": "Rock Paper Scissors"}


# ── Schemas ──

class CreateChallengeRequest(BaseModel):
    opponent_id: str
    game_type: str  # "tic-tac-toe" | "rps"
    wager_text: Optional[str] = ""


# ── Helpers ──

def _serialize_message(doc: dict) -> dict:
    """Convert MongoDB DM message doc to JSON-safe dict."""
    if doc is None:
        return None
    doc["_id"] = str(doc["_id"])
    if "timestamp" in doc and isinstance(doc["timestamp"], datetime):
        # Add Z to indicate UTC so frontend parses it correctly
        doc["timestamp"] = doc["timestamp"].isoformat() + "Z"
    
    # Serialize nested challenge_data datetimes
    cd = doc.get("challenge_data")
    if cd and "expires_at" in cd and isinstance(cd["expires_at"], datetime):
        cd["expires_at"] = cd["expires_at"].isoformat() + "Z"
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


def _build_socket_payload(msg_doc: dict, sender_user: dict) -> dict:
    """Build the standard dm_new_message socket payload."""
    timestamp = msg_doc["timestamp"]
    return {
        "_id": str(msg_doc["_id"]),
        "content": msg_doc.get("content"),
        "sender_id": str(msg_doc["sender_id"]),
        "receiver_id": str(msg_doc["receiver_id"]),
        "timestamp": timestamp.isoformat() + "Z" if isinstance(timestamp, datetime) else str(timestamp),
        "attachments": msg_doc.get("attachments", []),
        "is_read": msg_doc.get("is_read", False),
        "type": msg_doc.get("type", "text"),
        "challenge_data": msg_doc.get("challenge_data"),
        "sender": {
            "username": sender_user.get("username"),
            "avatar_url": sender_user.get("avatar_url"),
            "display_name": sender_user.get("display_name"),
            "_id": str(sender_user["_id"]),
        },
    }


# ── Endpoints ──

@router.post("/challenge")
async def create_challenge(
    body: CreateChallengeRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Send a game challenge as a DM message.
    The message has type='game_challenge' with a challenge_data payload.
    It is stored in the direct_messages collection so it inherits:
      - Unread badge tracking
      - Chat history persistence
      - Standard socket delivery
    """
    # Fix ObjectId vs string bug by casting current_user["_id"] to str
    challenger_id = str(current_user["_id"])
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
    dms = get_direct_messages_collection()
    now = datetime.utcnow()
    existing = await dms.find_one({
        "sender_id": challenger_id,
        "receiver_id": opponent_id,
        "type": "game_challenge",
        "challenge_data.status": "pending",
        "challenge_data.expires_at": {"$gt": now},
    })
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have a pending challenge with this user.",
        )

    # Fix: use empty string fallback so it moves to username if display_name is ""
    challenger_display = current_user.get("display_name")
    challenger_name = challenger_display if challenger_display else current_user.get("username", "Unknown")
    
    opponent_display = opponent.get("display_name")
    opponent_name = opponent_display if opponent_display else opponent.get("username", "Unknown")
    
    game_label = GAME_LABELS.get(body.game_type, body.game_type)

    # Create challenge as a DM message
    message_doc = {
        "sender_id": challenger_id,
        "receiver_id": opponent_id,
        "content": f"🎮 {challenger_name} challenged you to {game_label}!",
        "type": "game_challenge",
        "challenge_data": {
            "game_type": body.game_type,
            "wager_text": body.wager_text or "",
            "status": "pending",
            "challenger_name": challenger_name,
            "opponent_name": opponent_name,
            "expires_at": now + timedelta(minutes=CHALLENGE_TTL_MINUTES),
        },
        "attachments": [],
        "timestamp": now,
        "is_read": False,
    }

    result = await dms.insert_one(message_doc)
    message_doc["_id"] = result.inserted_id

    # Build and emit as standard dm_new_message to both users
    payload = _build_socket_payload(message_doc, current_user)

    try:
        # Emit to opponent (triggers unread badge naturally)
        await sio.emit("dm_new_message", payload, room=str(opponent_id), namespace="/chat")
        # Emit to sender (for multi-tab sync)
        await sio.emit("dm_new_message", payload, room=str(challenger_id), namespace="/chat")
    except Exception as e:
        print(f"⚠️ Challenge Socket Emit Error: {e}")

    serialized = _serialize_message(message_doc)
    return {"challenge": serialized, "dm": serialized}


@router.post("/challenge/{message_id}/accept")
async def accept_challenge(
    message_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Accept a pending game challenge.
    Updates the challenge_data.status in the DM message and emits:
      - dm_updated: so both clients re-render the card
      - game:start: so both clients navigate to the game board
    """
    dms = get_direct_messages_collection()

    try:
        doc = await dms.find_one({"_id": ObjectId(message_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid message ID.")

    if not doc:
        raise HTTPException(status_code=404, detail="Challenge not found.")

    # Verify it's a game challenge
    if doc.get("type") != "game_challenge":
        raise HTTPException(status_code=400, detail="This message is not a game challenge.")

    cd = doc.get("challenge_data", {})

    # Must be the receiver (opponent)
    if doc["receiver_id"] != current_user["_id"]:
        raise HTTPException(status_code=403, detail="Only the challenged user can accept.")

    # Must be pending
    if cd.get("status") != "pending":
        raise HTTPException(status_code=400, detail=f"Challenge is already {cd.get('status')}.")

    # Must not be expired
    expires_at = cd.get("expires_at")
    if isinstance(expires_at, datetime) and expires_at < datetime.utcnow():
        await dms.update_one(
            {"_id": doc["_id"]},
            {"$set": {"challenge_data.status": "expired"}},
        )
        raise HTTPException(status_code=400, detail="Challenge has expired.")

    # Generate unique game room ID
    game_room_id = f"game_{message_id}"

    # Update the challenge status in the DM message
    await dms.update_one(
        {"_id": doc["_id"]},
        {"$set": {
            "challenge_data.status": "accepted",
            "challenge_data.game_room_id": game_room_id,
        }},
    )

    # Re-fetch the updated doc for emission
    updated_doc = await dms.find_one({"_id": doc["_id"]})
    serialized = _serialize_message(updated_doc.copy())

    # Build dm_updated payload (for card re-render)
    updated_payload = {
        "_id": str(updated_doc["_id"]),
        "sender_id": str(updated_doc["sender_id"]),
        "receiver_id": str(updated_doc["receiver_id"]),
        "type": "game_challenge",
        "challenge_data": serialized.get("challenge_data"),
    }

    challenger_id = doc["sender_id"]
    opponent_id = doc["receiver_id"]

    try:
        # Emit dm_updated to both users so the card re-renders
        await sio.emit("dm_updated", updated_payload, room=str(challenger_id), namespace="/chat")
        await sio.emit("dm_updated", updated_payload, room=str(opponent_id), namespace="/chat")

        # Emit game:start to both players for auto-navigation
        game_start_payload = {
            "challenge_id": str(doc["_id"]),
            "game_room_id": game_room_id,
            "game_type": cd["game_type"],
            "challenger_id": challenger_id,
            "opponent_id": opponent_id,
            "challenger_name": cd.get("challenger_name", "Player 1"),
            "opponent_name": cd.get("opponent_name", "Player 2"),
        }
        await sio.emit("game:start", game_start_payload, room=f"user_{challenger_id}", namespace="/chat")
        await sio.emit("game:start", game_start_payload, room=f"user_{opponent_id}", namespace="/chat")
    except Exception as e:
        print(f"⚠️ Accept Challenge Socket Error: {e}")

    return {"challenge": serialized}


@router.post("/challenge/{message_id}/decline")
async def decline_challenge(
    message_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Decline a pending game challenge.
    Updates the challenge_data.status in the DM message and emits dm_updated.
    """
    dms = get_direct_messages_collection()

    try:
        doc = await dms.find_one({"_id": ObjectId(message_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid message ID.")

    if not doc:
        raise HTTPException(status_code=404, detail="Challenge not found.")

    if doc.get("type") != "game_challenge":
        raise HTTPException(status_code=400, detail="This message is not a game challenge.")

    cd = doc.get("challenge_data", {})

    # Must be the receiver (opponent)
    if doc["receiver_id"] != current_user["_id"]:
        raise HTTPException(status_code=403, detail="Only the challenged user can decline.")

    # Must be pending
    if cd.get("status") != "pending":
        raise HTTPException(status_code=400, detail=f"Challenge is already {cd.get('status')}.")

    # Decline
    await dms.update_one(
        {"_id": doc["_id"]},
        {"$set": {"challenge_data.status": "declined"}},
    )

    updated_doc = await dms.find_one({"_id": doc["_id"]})
    serialized = _serialize_message(updated_doc.copy())

    updated_payload = {
        "_id": str(updated_doc["_id"]),
        "sender_id": str(updated_doc["sender_id"]),
        "receiver_id": str(updated_doc["receiver_id"]),
        "type": "game_challenge",
        "challenge_data": serialized.get("challenge_data"),
    }

    challenger_id = doc["sender_id"]
    opponent_id = doc["receiver_id"]

    try:
        await sio.emit("dm_updated", updated_payload, room=str(challenger_id), namespace="/chat")
        await sio.emit("dm_updated", updated_payload, room=str(opponent_id), namespace="/chat")
    except Exception as e:
        print(f"⚠️ Decline Challenge Socket Error: {e}")

    return {"challenge": serialized}
