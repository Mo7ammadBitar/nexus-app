"""
Game Challenges Routes — Unified Message Architecture
======================================================
Challenges are stored as regular DM messages with type='game_challenge'
and a challenge_data JSON payload. This ensures:
  - Unread badge increments naturally
  - Challenge persists in chat history across reloads
  - Standard dm_new_message / dm_updated socket delivery

Improvements over v1:
  - Consistent ObjectId/str handling via normalize_id()
  - Centralized socket emission with _emit_to_users()
  - Rate limiting to prevent challenge spam
  - Structured logging replacing bare print()
  - Granular HTTP status codes
  - Lean DB projections instead of full document fetches
  - TTL-aware expiry handled by a single helper
  - Cancellation endpoint for the challenger
  - Game result recording endpoint
"""

import logging
from fastapi import APIRouter, HTTPException, status, Depends, Request
from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime, timedelta
from bson import ObjectId

from app.middleware.auth import get_current_user
from app.database import (
    get_direct_messages_collection,
    get_users_collection,
    get_friends_collection,
)
from app.socket_instance import sio

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/games", tags=["Games"])

# ── Constants ────────────────────────────────────────────────────────────────

CHALLENGE_TTL_MINUTES = 5
MAX_PENDING_CHALLENGES_PER_USER = 5  # Rate-limit: max simultaneous outgoing challenges

VALID_GAME_TYPES = {"tic-tac-toe", "rps"}
GAME_LABELS = {
    "tic-tac-toe": "Tic-Tac-Toe",
    "rps": "Rock Paper Scissors",
}

VALID_GAME_RESULTS = {"win", "loss", "draw"}


# ── Schemas ───────────────────────────────────────────────────────────────────

class CreateChallengeRequest(BaseModel):
    opponent_id: str
    game_type: str
    wager_text: Optional[str] = ""

    @field_validator("game_type")
    @classmethod
    def validate_game_type(cls, v: str) -> str:
        if v not in VALID_GAME_TYPES:
            raise ValueError(f"game_type must be one of: {', '.join(sorted(VALID_GAME_TYPES))}")
        return v

    @field_validator("opponent_id")
    @classmethod
    def validate_opponent_id(cls, v: str) -> str:
        if not ObjectId.is_valid(v):
            raise ValueError("opponent_id is not a valid ObjectId")
        return v


class RecordResultRequest(BaseModel):
    result: str  # "win" | "loss" | "draw" from the perspective of the reporting user

    @field_validator("result")
    @classmethod
    def validate_result(cls, v: str) -> str:
        if v not in VALID_GAME_RESULTS:
            raise ValueError(f"result must be one of: {', '.join(sorted(VALID_GAME_RESULTS))}")
        return v


# ── Utility helpers ───────────────────────────────────────────────────────────

def normalize_id(value) -> str:
    """Always return a plain str, regardless of whether value is ObjectId or str."""
    return str(value)


def _get_display_name(user: dict) -> str:
    """Return display_name if non-empty, otherwise fall back to username."""
    return (user.get("display_name") or "").strip() or user.get("username", "Unknown")


def _is_expired(challenge_data: dict) -> bool:
    """Return True if the challenge has passed its TTL."""
    expires_at = challenge_data.get("expires_at")
    if isinstance(expires_at, datetime):
        return expires_at < datetime.utcnow()
    return False


# ── DB helpers ────────────────────────────────────────────────────────────────

async def _check_friendship(user_id: str, friend_id: str) -> bool:
    """Verify two users share an accepted friendship."""
    friends = get_friends_collection()
    friendship = await friends.find_one(
        {
            "$or": [
                {"requester_id": user_id, "receiver_id": friend_id, "status": "accepted"},
                {"requester_id": friend_id, "receiver_id": user_id, "status": "accepted"},
            ]
        },
        projection={"_id": 1},  # We only need existence, not the full document
    )
    return friendship is not None


async def _count_pending_outgoing(challenger_id: str) -> int:
    """Count how many unexpired, pending challenges this user has already sent."""
    dms = get_direct_messages_collection()
    return await dms.count_documents(
        {
            "sender_id": challenger_id,
            "type": "game_challenge",
            "challenge_data.status": "pending",
            "challenge_data.expires_at": {"$gt": datetime.utcnow()},
        }
    )


async def _fetch_user(user_id: str, projection: Optional[dict] = None) -> dict:
    """Fetch a single user by string ID, raising 404 if not found."""
    users = get_users_collection()
    doc = await users.find_one({"_id": ObjectId(user_id)}, projection=projection)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    return doc


async def _fetch_challenge_doc(message_id: str) -> dict:
    """
    Fetch a game_challenge DM message by ID.
    Raises 400 for invalid ID and 404 if not found.
    """
    if not ObjectId.is_valid(message_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid message ID.")

    dms = get_direct_messages_collection()
    doc = await dms.find_one({"_id": ObjectId(message_id)})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Challenge not found.")
    if doc.get("type") != "game_challenge":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This message is not a game challenge.",
        )
    return doc


# ── Serialization helpers ─────────────────────────────────────────────────────

def _serialize_datetime(value) -> Optional[str]:
    """Return ISO-8601 UTC string with trailing 'Z', or None."""
    if isinstance(value, datetime):
        return value.isoformat() + "Z"
    return value  # already a string or None


def _serialize_message(doc: dict) -> dict:
    """Convert a MongoDB DM message doc to a JSON-safe dict (mutates a copy)."""
    doc = doc.copy()
    doc["_id"] = normalize_id(doc["_id"])
    doc["sender_id"] = normalize_id(doc.get("sender_id", ""))
    doc["receiver_id"] = normalize_id(doc.get("receiver_id", ""))
    doc["timestamp"] = _serialize_datetime(doc.get("timestamp"))

    cd = doc.get("challenge_data")
    if cd:
        cd = cd.copy()
        cd["expires_at"] = _serialize_datetime(cd.get("expires_at"))
        doc["challenge_data"] = cd

    return doc


def _build_new_message_payload(msg_doc: dict, sender_user: dict) -> dict:
    """Build the standard dm_new_message socket payload."""
    timestamp = msg_doc.get("timestamp")
    return {
        "_id": normalize_id(msg_doc["_id"]),
        "content": msg_doc.get("content"),
        "sender_id": normalize_id(msg_doc["sender_id"]),
        "receiver_id": normalize_id(msg_doc["receiver_id"]),
        "timestamp": _serialize_datetime(timestamp),
        "attachments": msg_doc.get("attachments", []),
        "is_read": msg_doc.get("is_read", False),
        "type": msg_doc.get("type", "text"),
        "challenge_data": msg_doc.get("challenge_data"),
        "sender": {
            "_id": normalize_id(sender_user["_id"]),
            "username": sender_user.get("username"),
            "avatar_url": sender_user.get("avatar_url"),
            "display_name": sender_user.get("display_name"),
        },
    }


def _build_updated_payload(doc: dict, serialized_cd: dict) -> dict:
    """Build the dm_updated socket payload after a status change."""
    return {
        "_id": normalize_id(doc["_id"]),
        "sender_id": normalize_id(doc["sender_id"]),
        "receiver_id": normalize_id(doc["receiver_id"]),
        "type": "game_challenge",
        "challenge_data": serialized_cd,
    }


# ── Socket helpers ────────────────────────────────────────────────────────────

async def _emit_to_users(event: str, payload: dict, *user_ids: str) -> None:
    """
    Emit a socket event to one or more user rooms.
    Swallows exceptions so a socket failure never breaks the HTTP response.
    """
    for uid in user_ids:
        try:
            await sio.emit(event, payload, room=str(uid), namespace="/chat")
        except Exception as exc:  # noqa: BLE001
            logger.warning("Socket emit failed [event=%s, room=%s]: %s", event, uid, exc)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/challenge", status_code=status.HTTP_201_CREATED)
async def create_challenge(
    body: CreateChallengeRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Send a game challenge as a DM message (type='game_challenge').

    The message is stored in direct_messages so it inherits:
      - Unread badge tracking
      - Chat history persistence
      - Standard socket delivery (dm_new_message)
    """
    challenger_id = normalize_id(current_user["_id"])
    opponent_id = body.opponent_id

    if challenger_id == opponent_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot challenge yourself.",
        )

    # Fetch opponent (lean projection — we only need display info)
    opponent = await _fetch_user(
        opponent_id,
        projection={"username": 1, "display_name": 1, "avatar_url": 1},
    )

    # Verify friendship
    if not await _check_friendship(challenger_id, opponent_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only challenge friends.",
        )

    # Rate-limit: prevent spam challenges
    pending_count = await _count_pending_outgoing(challenger_id)
    if pending_count >= MAX_PENDING_CHALLENGES_PER_USER:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"You already have {pending_count} pending challenges. Wait for them to expire or be answered.",
        )

    # Check for a duplicate pending challenge to this specific opponent
    dms = get_direct_messages_collection()
    now = datetime.utcnow()
    duplicate = await dms.find_one(
        {
            "sender_id": challenger_id,
            "receiver_id": opponent_id,
            "type": "game_challenge",
            "challenge_data.status": "pending",
            "challenge_data.expires_at": {"$gt": now},
        },
        projection={"_id": 1},
    )
    if duplicate:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have a pending challenge with this user.",
        )

    challenger_name = _get_display_name(current_user)
    opponent_name = _get_display_name(opponent)
    game_label = GAME_LABELS[body.game_type]

    message_doc = {
        "sender_id": challenger_id,
        "receiver_id": opponent_id,
        "content": f"🎮 {challenger_name} challenged you to {game_label}!",
        "type": "game_challenge",
        "challenge_data": {
            "game_type": body.game_type,
            "wager_text": (body.wager_text or "").strip(),
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

    cd = message_doc.get("challenge_data", {})
    if cd and isinstance(cd.get("expires_at"), datetime):
        cd = cd.copy()
        cd["expires_at"] = cd["expires_at"].isoformat() + "Z"
        message_doc["challenge_data"] = cd

    payload = _build_new_message_payload(message_doc, current_user)

    # Emit to opponent (triggers unread badge) and to sender (multi-tab sync)
    await _emit_to_users("dm_new_message", payload, opponent_id, challenger_id)

    logger.info(
        "Challenge created [id=%s, game=%s, from=%s, to=%s]",
        result.inserted_id, body.game_type, challenger_id, opponent_id,
    )

    serialized = _serialize_message(message_doc)
    return {"challenge": serialized, "dm": serialized}


@router.post("/challenge/{message_id}/accept")
async def accept_challenge(
    message_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Accept a pending game challenge.

    Updates challenge_data.status → 'accepted' in the DM message and emits:
      - dm_updated  → both clients re-render the challenge card
      - game:start  → both clients navigate to the game board
    """
    doc = await _fetch_challenge_doc(message_id)
    cd = doc.get("challenge_data", {})

    current_user_id = normalize_id(current_user["_id"])
    receiver_id = normalize_id(doc["receiver_id"])
    challenger_id = normalize_id(doc["sender_id"])

    if receiver_id != current_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the challenged user can accept.",
        )

    if cd.get("status") != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Challenge is already '{cd.get('status')}'.",
        )

    if _is_expired(cd):
        dms = get_direct_messages_collection()
        await dms.update_one(
            {"_id": doc["_id"]},
            {"$set": {"challenge_data.status": "expired"}},
        )
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Challenge has expired.",
        )

    game_room_id = f"game_{message_id}"

    dms = get_direct_messages_collection()
    await dms.update_one(
        {"_id": doc["_id"]},
        {"$set": {
            "challenge_data.status": "accepted",
            "challenge_data.game_room_id": game_room_id,
        }},
    )

    updated_doc = await dms.find_one({"_id": doc["_id"]})
    serialized = _serialize_message(updated_doc.copy())

    updated_payload = _build_updated_payload(updated_doc, serialized["challenge_data"])
    await _emit_to_users("dm_updated", updated_payload, challenger_id, receiver_id)

    game_start_payload = {
        "challenge_id": str(doc["_id"]),
        "game_room_id": game_room_id,
        "game_type": cd["game_type"],
        "challenger_id": challenger_id,
        "opponent_id": receiver_id,
        "challenger_name": cd.get("challenger_name", "Player 1"),
        "opponent_name": cd.get("opponent_name", "Player 2"),
    }
    # game:start is sent to personal rooms (prefixed) for accurate targeting
    await _emit_to_users(
        "game:start", game_start_payload,
        f"user_{challenger_id}", f"user_{receiver_id}",
    )

    logger.info(
        "Challenge accepted [id=%s, game=%s, room=%s]",
        message_id, cd.get("game_type"), game_room_id,
    )

    return {"challenge": serialized}


@router.post("/challenge/{message_id}/decline")
async def decline_challenge(
    message_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Decline a pending game challenge.

    Updates challenge_data.status → 'declined' and emits dm_updated.
    """
    doc = await _fetch_challenge_doc(message_id)
    cd = doc.get("challenge_data", {})

    current_user_id = normalize_id(current_user["_id"])
    receiver_id = normalize_id(doc["receiver_id"])
    challenger_id = normalize_id(doc["sender_id"])

    if receiver_id != current_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the challenged user can decline.",
        )

    if cd.get("status") != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Challenge is already '{cd.get('status')}'.",
        )

    dms = get_direct_messages_collection()
    await dms.update_one(
        {"_id": doc["_id"]},
        {"$set": {"challenge_data.status": "declined"}},
    )

    updated_doc = await dms.find_one({"_id": doc["_id"]})
    serialized = _serialize_message(updated_doc.copy())

    updated_payload = _build_updated_payload(updated_doc, serialized["challenge_data"])
    await _emit_to_users("dm_updated", updated_payload, challenger_id, receiver_id)

    logger.info("Challenge declined [id=%s]", message_id)

    return {"challenge": serialized}


@router.post("/challenge/{message_id}/cancel")
async def cancel_challenge(
    message_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Cancel a pending challenge (challenger only).

    Allows the sender to retract an unanswered challenge before it expires.
    Emits dm_updated so both clients hide/update the card.
    """
    doc = await _fetch_challenge_doc(message_id)
    cd = doc.get("challenge_data", {})

    current_user_id = normalize_id(current_user["_id"])
    challenger_id = normalize_id(doc["sender_id"])
    receiver_id = normalize_id(doc["receiver_id"])

    if challenger_id != current_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the challenger can cancel a challenge.",
        )

    if cd.get("status") != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Challenge is already '{cd.get('status')}' and cannot be cancelled.",
        )

    dms = get_direct_messages_collection()
    await dms.update_one(
        {"_id": doc["_id"]},
        {"$set": {"challenge_data.status": "cancelled"}},
    )

    updated_doc = await dms.find_one({"_id": doc["_id"]})
    serialized = _serialize_message(updated_doc.copy())

    updated_payload = _build_updated_payload(updated_doc, serialized["challenge_data"])
    await _emit_to_users("dm_updated", updated_payload, challenger_id, receiver_id)

    logger.info("Challenge cancelled [id=%s, by=%s]", message_id, current_user_id)

    return {"challenge": serialized}


@router.post("/challenge/{message_id}/result")
async def record_game_result(
    message_id: str,
    body: RecordResultRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Record the final result of an accepted game (win / loss / draw).

    Only participants (challenger or opponent) can report the result.
    Result is stored from the perspective of the reporting user.
    Emits game:result so both clients can show a result screen.

    SECURITY: Shard wagering is DISABLED. This endpoint accepts the result
    from one participant with zero server-side game-state validation.
    Any aether_shards transfer here would allow a malicious client to
    self-report a "win" and steal shards. A server-authoritative game
    engine is required before shard payouts can be enabled.
    """
    doc = await _fetch_challenge_doc(message_id)
    cd = doc.get("challenge_data", {})

    # Reject any shard/wager payout attempt
    if cd.get("wager_shards") or cd.get("wager_amount"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Shard wagering is disabled. Game results are client-reported "
                   "and cannot be trusted for currency transfers. A server-authoritative "
                   "game engine is required before shard payouts can be enabled.",
        )

    current_user_id = normalize_id(current_user["_id"])
    challenger_id = normalize_id(doc["sender_id"])
    receiver_id = normalize_id(doc["receiver_id"])

    if current_user_id not in {challenger_id, receiver_id}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only participants can report a game result.",
        )

    if cd.get("status") != "accepted":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Results can only be recorded for accepted (in-progress) challenges.",
        )

    # Derive the opponent's result
    if body.result == "draw":
        opponent_result = "draw"
    elif body.result == "win":
        opponent_result = "loss"
    else:
        opponent_result = "win"

    dms = get_direct_messages_collection()
    await dms.update_one(
        {"_id": doc["_id"]},
        {"$set": {
            "challenge_data.status": "completed",
            "challenge_data.result": {
                "reporter_id": current_user_id,
                "reporter_result": body.result,
                "opponent_result": opponent_result,
                "recorded_at": datetime.utcnow().isoformat() + "Z",
            },
        }},
    )

    updated_doc = await dms.find_one({"_id": doc["_id"]})
    serialized = _serialize_message(updated_doc.copy())

    result_payload = {
        "challenge_id": message_id,
        "game_room_id": cd.get("game_room_id"),
        "reporter_id": current_user_id,
        "result": body.result,
        "opponent_result": opponent_result,
    }
    await _emit_to_users("game:result", result_payload, challenger_id, receiver_id)

    updated_payload = _build_updated_payload(updated_doc, serialized["challenge_data"])
    await _emit_to_users("dm_updated", updated_payload, challenger_id, receiver_id)

    logger.info(
        "Game result recorded [id=%s, reporter=%s, result=%s]",
        message_id, current_user_id, body.result,
    )

    return {"challenge": serialized}