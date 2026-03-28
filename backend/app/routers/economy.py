"""
Economy Routes - Aether Shards
Legacy ad-based claim endpoint removed. Quest rewards are now handled in quests.py.
This file is kept for potential future economy endpoints.
"""
from fastapi import APIRouter

router = APIRouter(prefix="/economy", tags=["Economy"])


# All economy-related shard earning is now handled by the Quests system.
# See app/routers/quests.py for GET /quests and POST /quests/{quest_id}/claim
