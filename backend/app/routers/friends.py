"""
Friends Routes - Friend Requests and Management
"""
from fastapi import APIRouter, HTTPException, status, Depends
from typing import List
from app.socket_instance import sio
from app.middleware.auth import get_current_user
from app.services.friend_service import FriendService
from app.services.auth_service import AuthService

router = APIRouter(prefix="/friends", tags=["Friends"])


@router.post("/request/{username}")
async def send_friend_request(
    username: str,
    current_user: dict = Depends(get_current_user)
):
    """Send a friend request to a user by username."""
    # Find user by username
    target_user = await AuthService.get_user_by_username(username)
    
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if target_user.get("is_deleted"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    try:
        request = await FriendService.send_friend_request(
            current_user["_id"],
            target_user["_id"]
        )
        room = str(target_user['_id'])
        await sio.emit("friend_request_received", {"request_id": request["_id"]}, room=room, namespace="/chat")
        
        return {
            "message": "Friend request sent",
            "request_id": request["_id"]
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/accept/{request_id}")
async def accept_friend_request(
    request_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Accept a pending friend request."""
    try:
        request = await FriendService.accept_friend_request(
            request_id,
            current_user["_id"]
        )
        return {"message": "Friend request accepted", "request": request}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/reject/{request_id}")
async def reject_friend_request(
    request_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Reject a pending friend request."""
    try:
        request = await FriendService.reject_friend_request(
            request_id,
            current_user["_id"]
        )
        return {"message": "Friend request rejected", "request": request}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/cancel/{request_id}")
async def cancel_friend_request(
    request_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Cancel a sent friend request."""
    success = await FriendService.cancel_friend_request(
        request_id,
        current_user["_id"]
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found or already processed"
        )
    
    return {"message": "Friend request cancelled"}


@router.delete("/{friend_id}")
async def remove_friend(
    friend_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Remove a friend."""
    success = await FriendService.remove_friend(
        current_user["_id"],
        friend_id
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Friend not found"
        )
    
    return {"message": "Friend removed"}


@router.get("")
async def get_friends(current_user: dict = Depends(get_current_user)):
    """Get list of all friends."""
    friends = await FriendService.get_friends(current_user["_id"])
    return {"friends": friends}


@router.get("/requests/pending")
async def get_pending_requests(current_user: dict = Depends(get_current_user)):
    """Get pending friend requests received."""
    requests = await FriendService.get_pending_requests(current_user["_id"])
    return {"requests": requests}


@router.get("/requests/sent")
async def get_sent_requests(current_user: dict = Depends(get_current_user)):
    """Get friend requests sent by current user."""
    requests = await FriendService.get_sent_requests(current_user["_id"])
    return {"requests": requests}


@router.get("/status/{user_id}")
async def get_friendship_status(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get friendship status between current user and target user.
    Returns: 'friends', 'pending_sent', 'pending_received', or 'none'
    """
    # Don't check status with yourself
    if user_id == current_user["_id"]:
        return {"status": "self", "request_id": None}
    
    status_result = await FriendService.get_friendship_status(
        current_user["_id"],
        user_id
    )
    return status_result

