"""
The Oracle Routes — System Bot API
"""
import asyncio
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.middleware.auth import get_current_user
from app.services.oracle_service import OracleService

router = APIRouter(prefix="/oracle", tags=["Oracle"])


class OracleAskRequest(BaseModel):
    content: str


class OracleMessageRequest(BaseModel):
    content: str


@router.post("/summarize")
async def summarize_message(
    request: OracleMessageRequest,
    current_user: dict = Depends(get_current_user)
):
    """Distill Essence — summarize a message."""
    if not request.content or not request.content.strip():
        raise HTTPException(status_code=400, detail="No content to summarize")

    return await OracleService.distill_message_essence(request.content)


@router.post("/explain")
async def explain_message(
    request: OracleMessageRequest,
    current_user: dict = Depends(get_current_user)
):
    """Unveil Meaning — explain a message's context."""
    if not request.content or not request.content.strip():
        raise HTTPException(status_code=400, detail="No content to explain")

    return await OracleService.unveil_message_meaning(request.content)
