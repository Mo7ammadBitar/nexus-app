"""
Preview Routes - Message Link Previews with Access Control
"""
from fastapi import APIRouter, HTTPException, status, Depends

from app.middleware.auth import get_current_user
from app.services.message_service import MessageService
from app.services.server_service import MemberService, ChannelService, ServerService

router = APIRouter(prefix="/preview", tags=["Preview"])


@router.get("/message/{server_id}/{channel_id}/{message_id}")
async def get_message_preview(
    server_id: str,
    channel_id: str,
    message_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get a preview of a message for rich link display.
    Returns server and channel info only if user is a member.
    """
    # Check if user is a member of the server
    member = await MemberService.get_member(server_id, current_user["_id"])
    
    if not member:
        # User is not a member - return access denied
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "NOT_MEMBER",
                "message": "You do not have access to this server"
            }
        )
    
    # Get server info
    server = await ServerService.get_server_by_id(server_id)
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Server not found"
        )
    
    # Get channel info
    channel = await ChannelService.get_channel_by_id(channel_id)
    if not channel or channel.get("server_id") != server_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Channel not found"
        )
    
    # Get message preview
    message_preview = await MessageService.get_message_for_preview(message_id)
    if not message_preview:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )
    
    return {
        "server_name": server.get("name"),
        "server_icon_url": server.get("icon_url"),
        "channel_name": channel.get("name"),
        "message_snippet": message_preview.get("content_snippet"),
        "author_username": message_preview.get("author_username"),
        "accessible": True
    }
