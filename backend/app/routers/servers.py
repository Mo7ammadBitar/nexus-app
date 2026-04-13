"""
Server Routes - Server, Channel, Member Management
"""
from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File
from typing import List

from app.middleware.auth import get_current_user
from app.services.server_service import ServerService, MemberService, ChannelService
from app.services.cloudinary_service import upload_file as cloudinary_upload
from app.schemas.server import (
    CreateServerRequest,
    UpdateServerRequest,
    JoinServerRequest,
    CreateChannelRequest,
    UpdateChannelRequest,
    MuteRequest,
    ChannelMemberRequest,
)
from app.models.server import ServerRole, ChannelType

router = APIRouter(prefix="/servers", tags=["Servers"])


# ============ Server CRUD ============

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_server(
    request: CreateServerRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a new server. Creator becomes owner."""
    server = await ServerService.create_server(
        name=request.name,
        owner_id=current_user["_id"]
    )
    
    return {
        "message": "Server created successfully",
        "server": {
            "_id": server["_id"],
            "name": server["name"],
            "invite_code": server["invite_code"],
            "owner_id": server["owner_id"]
        }
    }


@router.get("")
async def get_my_servers(current_user: dict = Depends(get_current_user)):
    """Get all servers the current user is a member of."""
    servers = await ServerService.get_user_servers(current_user["_id"])
    return {"servers": servers}


@router.get("/{server_id}")
async def get_server(
    server_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get server details (must be a member)."""
    # Check membership
    member = await MemberService.get_member(server_id, current_user["_id"])
    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this server"
        )
    
    server = await ServerService.get_server_by_id(server_id)
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Server not found"
        )
    
    # Check if server is banned
    if server.get("is_banned"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Server is banned. Reason: {server.get('ban_reason', 'No reason provided')}"
        )
    
    # Get channels
    channels = await ChannelService.get_server_channels(server_id)
    
    # Get member count
    members = await MemberService.get_server_members(server_id)
    
    return {
        **server,
        "channels": channels,
        "member_count": len(members),
        "my_role": member["role"]
    }


@router.put("/{server_id}")
async def update_server(
    server_id: str,
    request: UpdateServerRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update server (owner only)."""
    # Check ownership
    member = await MemberService.get_member(server_id, current_user["_id"])
    if not member or member["role"] != ServerRole.OWNER.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only server owner can update server settings"
        )
    
    update_data = {}
    if request.name:
        update_data["name"] = request.name
    
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )
    
    updated = await ServerService.update_server(server_id, update_data)
    return {"message": "Server updated", "server": updated}


@router.delete("/{server_id}")
async def delete_server(
    server_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete server (owner only)."""
    member = await MemberService.get_member(server_id, current_user["_id"])
    if not member or member["role"] != ServerRole.OWNER.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only server owner can delete the server"
        )
    
    await ServerService.delete_server(server_id)
    return {"message": "Server deleted successfully"}


# ============ Join/Leave ============

@router.post("/join")
async def join_server(
    request: JoinServerRequest,
    current_user: dict = Depends(get_current_user)
):
    """Join a server using invite code."""
    server = await ServerService.get_server_by_invite_code(request.invite_code)
    
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid invite code or server not found"
        )
    
    try:
        await MemberService.join_server(server["_id"], current_user["_id"])
        
        # Quest: increment total_servers_joined
        try:
            from app.database import get_users_collection
            from bson import ObjectId
            users_col = get_users_collection()
            await users_col.update_one(
                {"_id": ObjectId(current_user["_id"])},
                {"$inc": {"total_servers_joined": 1}}
            )
        except Exception:
            pass  # Non-critical
        
        return {
            "message": "Joined server successfully",
            "server": {
                "_id": server["_id"],
                "name": server["name"]
            }
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/{server_id}/leave")
async def leave_server(
    server_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Leave a server."""
    try:
        await MemberService.leave_server(server_id, current_user["_id"])
        return {"message": "Left server successfully"}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


# ============ Members ============

@router.get("/{server_id}/members")
async def get_members(
    server_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all members of a server."""
    member = await MemberService.get_member(server_id, current_user["_id"])
    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this server"
        )
    
    members = await MemberService.get_server_members(server_id)
    return {"members": members}


@router.post("/{server_id}/members/{user_id}/promote")
async def promote_member(
    server_id: str,
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Promote member to moderator (owner only)."""
    member = await MemberService.get_member(server_id, current_user["_id"])
    if not member or member["role"] != ServerRole.OWNER.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only server owner can promote members"
        )
    
    try:
        promoted = await MemberService.promote_to_moderator(server_id, user_id)
        return {"message": "Member promoted to moderator", "member": promoted}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/{server_id}/members/{user_id}/demote")
async def demote_member(
    server_id: str,
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Demote moderator to member (owner only)."""
    member = await MemberService.get_member(server_id, current_user["_id"])
    if not member or member["role"] != ServerRole.OWNER.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only server owner can demote moderators"
        )
    
    try:
        demoted = await MemberService.demote_to_member(server_id, user_id)
        return {"message": "Moderator demoted to member", "member": demoted}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/{server_id}/members/{user_id}/mute")
async def mute_member(
    server_id: str,
    user_id: str,
    request: MuteRequest,
    current_user: dict = Depends(get_current_user)
):
    """Mute a member (owner/moderator)."""
    member = await MemberService.get_member(server_id, current_user["_id"])
    if not member or member["role"] not in [ServerRole.OWNER.value, ServerRole.MODERATOR.value]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owner or moderator can mute members"
        )
    
    try:
        muted = await MemberService.mute_member(
            server_id, user_id, request.reason, request.duration_hours
        )
        return {"message": "Member muted", "member": muted}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/{server_id}/members/{user_id}/unmute")
async def unmute_member(
    server_id: str,
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Unmute a member (owner/moderator)."""
    member = await MemberService.get_member(server_id, current_user["_id"])
    if not member or member["role"] not in [ServerRole.OWNER.value, ServerRole.MODERATOR.value]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owner or moderator can unmute members"
        )
    
    try:
        unmuted = await MemberService.unmute_member(server_id, user_id)
        return {"message": "Member unmuted", "member": unmuted}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/{server_id}/members/{user_id}/kick")
async def kick_member(
    server_id: str,
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Kick a member from server (owner/moderator)."""
    member = await MemberService.get_member(server_id, current_user["_id"])
    if not member or member["role"] not in [ServerRole.OWNER.value, ServerRole.MODERATOR.value]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owner or moderator can kick members"
        )
    
    # Prevent kicking owner
    target = await MemberService.get_member(server_id, user_id)
    if target and target["role"] == ServerRole.OWNER.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot kick server owner"
        )
    
    # Prevent moderator kicking another moderator
    if member["role"] == ServerRole.MODERATOR.value and target and target["role"] == ServerRole.MODERATOR.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Moderators cannot kick other moderators"
        )
    
    await MemberService.kick_member(server_id, user_id)
    return {"message": "Member kicked from server"}


# ============ Channels ============

@router.post("/{server_id}/channels", status_code=status.HTTP_201_CREATED)
async def create_channel(
    server_id: str,
    request: CreateChannelRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a new channel (owner only)."""
    member = await MemberService.get_member(server_id, current_user["_id"])
    if not member or member["role"] != ServerRole.OWNER.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only server owner can create channels"
        )
    
    try:
        channel_type = ChannelType.VOICE if request.type == "voice" else ChannelType.TEXT
        channel = await ChannelService.create_channel(server_id, request.name, channel_type)
        return {"message": "Channel created", "channel": channel}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/{server_id}/channels")
async def get_channels(
    server_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all channels in a server."""
    member = await MemberService.get_member(server_id, current_user["_id"])
    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this server"
        )
    
    channels = await ChannelService.get_server_channels(server_id)
    return {"channels": channels}


@router.put("/{server_id}/channels/{channel_id}")
async def update_channel(
    server_id: str,
    channel_id: str,
    request: UpdateChannelRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update channel (owner only)."""
    member = await MemberService.get_member(server_id, current_user["_id"])
    if not member or member["role"] != ServerRole.OWNER.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only server owner can update channels"
        )
    
    update_data = {}
    if request.name:
        update_data["name"] = request.name
    if request.send_permission:
        update_data["send_permission"] = request.send_permission
    
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update"
        )
    
    updated = await ChannelService.update_channel(channel_id, update_data)
    return {"message": "Channel updated", "channel": updated}


@router.delete("/{server_id}/channels/{channel_id}")
async def delete_channel(
    server_id: str,
    channel_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete channel (owner only)."""
    member = await MemberService.get_member(server_id, current_user["_id"])
    if not member or member["role"] != ServerRole.OWNER.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only server owner can delete channels"
        )
    
    await ChannelService.delete_channel(channel_id)
    return {"message": "Channel deleted"}


@router.post("/{server_id}/channels/{channel_id}/members")
async def add_member_to_channel(
    server_id: str,
    channel_id: str,
    request: ChannelMemberRequest,
    current_user: dict = Depends(get_current_user)
):
    """Add member to channel access list (owner/moderator)."""
    member = await MemberService.get_member(server_id, current_user["_id"])
    if not member or member["role"] not in [ServerRole.OWNER.value, ServerRole.MODERATOR.value]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owner or moderator can manage channel members"
        )
    
    channel = await ChannelService.add_member_to_channel(channel_id, request.user_id)
    return {"message": "Member added to channel", "channel": channel}


@router.delete("/{server_id}/channels/{channel_id}/members/{user_id}")
async def remove_member_from_channel(
    server_id: str,
    channel_id: str,
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Remove member from channel access list (owner/moderator)."""
    member = await MemberService.get_member(server_id, current_user["_id"])
    if not member or member["role"] not in [ServerRole.OWNER.value, ServerRole.MODERATOR.value]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owner or moderator can manage channel members"
        )
    
    channel = await ChannelService.remove_member_from_channel(channel_id, user_id)
    return {"message": "Member removed from channel", "channel": channel}


# ============ Server Asset Uploads ============

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}


@router.post("/{server_id}/icon")
async def upload_server_icon(
    server_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload server icon (owner only). Free for all servers."""
    # Check ownership
    member = await MemberService.get_member(server_id, current_user["_id"])
    if not member or member["role"] != ServerRole.OWNER.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only server owner can change server icon"
        )

    # Validate file type
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Allowed: jpg, png, gif, webp"
        )

    # Upload to Cloudinary
    icon_url = await cloudinary_upload(file, folder="nexus/server_icons")

    # Save to database
    updated = await ServerService.update_server(server_id, {"icon_url": icon_url})
    return {"message": "Server icon updated", "icon_url": icon_url, "server": updated}


@router.post("/{server_id}/banner")
async def upload_server_banner(
    server_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload server banner (owner only). Requires boost_level >= 1."""
    # Check ownership
    member = await MemberService.get_member(server_id, current_user["_id"])
    if not member or member["role"] != ServerRole.OWNER.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only server owner can change server banner"
        )

    # Verify boost level
    server = await ServerService.get_server_by_id(server_id)
    if not server or server.get("boost_level", 0) < 1:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Server needs at least Boost Level 1 to unlock custom banners"
        )

    # Validate file type
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Allowed: jpg, png, gif, webp"
        )

    # Upload to Cloudinary
    banner_url = await cloudinary_upload(file, folder="nexus/server_banners")

    # Save to database
    updated = await ServerService.update_server(server_id, {"banner_url": banner_url})
    return {"message": "Server banner updated", "banner_url": banner_url, "server": updated}


# ============ Nexus Sentinel ============

from app.models.server import SentinelSettings

@router.put("/{server_id}/sentinel")
async def update_sentinel_settings(
    server_id: str,
    settings: SentinelSettings,
    current_user: dict = Depends(get_current_user)
):
    """Update Nexus Sentinel settings (owner only)."""
    # Check ownership
    member = await MemberService.get_member(server_id, current_user["_id"])
    if not member or member["role"] != ServerRole.OWNER.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only server owner can configure Sentinel"
        )
    
    updated = await ServerService.update_server(server_id, {"sentinel_settings": settings.dict()})
    return {"message": "Sentinel settings updated", "server": updated}


@router.get("/{server_id}/audit-logs")
async def get_audit_logs(
    server_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get server audit logs (owner/moderator only)."""
    # Check ownership or moderator
    member = await MemberService.get_member(server_id, current_user["_id"])
    if not member or member["role"] not in [ServerRole.OWNER.value, ServerRole.MODERATOR.value]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owner or moderators can view audit logs"
        )
    
    from app.database import get_database
    db = get_database()
    cursor = db["audit_logs"].find({"server_id": server_id}).sort("created_at", -1).limit(100)
    logs = await cursor.to_list(length=100)
    
    # Process object ids for frontend
    for log in logs:
        if "_id" in log:
            log["_id"] = str(log["_id"])
            
    return {"audit_logs": logs}


@router.post("/{server_id}/members/{user_id}/pardon")
async def pardon_member(
    server_id: str,
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Reset a member's Sentinel strikes to 0 (owner/moderator)."""
    member = await MemberService.get_member(server_id, current_user["_id"])
    if not member or member["role"] not in [ServerRole.OWNER.value, ServerRole.MODERATOR.value]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owner or moderator can pardon members"
        )
    
    from app.database import get_members_collection
    members_col = get_members_collection()
    
    result = await members_col.update_one(
        {"server_id": server_id, "user_id": user_id},
        {"$set": {"strikes": 0, "timeout_until": None}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found or already pardoned"
        )
        
    return {"message": "Member has been pardoned (strikes reset to 0)"}

