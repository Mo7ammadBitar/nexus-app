"""
Support Tickets Routes
"""
from fastapi import APIRouter, HTTPException, status, Depends
from typing import List
from datetime import datetime
from bson import ObjectId
import json

from app.middleware.auth import get_current_user
from app.database import get_tickets_collection, get_ticket_messages_collection
from app.models.ticket import (
    TicketCreate, TicketResponse, TicketMessageCreate, 
    TicketMessageResponse, ReopenRequest, TicketInDB, TicketMessageInDB
)
from app.models.user import UserRole
import math

router = APIRouter(prefix="/support", tags=["Support"])

def is_admin(user: dict):
    if user.get("role") not in [UserRole.ADMIN.value, UserRole.SUPER_ADMIN.value, "admin", "super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
    return True

@router.post("/tickets", response_model=TicketResponse)
async def create_ticket(
    request: TicketCreate,
    current_user: dict = Depends(get_current_user)
):
    try:
        tickets_col = get_tickets_collection()
        messages_col = get_ticket_messages_collection()
        
        new_ticket = TicketInDB(
            user_id=str(current_user["_id"]),
            subject=request.subject,
            status="open",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        ticket_dict = new_ticket.dict(by_alias=True)
        ticket_dict["_id"] = ObjectId()
        await tickets_col.insert_one(ticket_dict)
        
        init_msg = TicketMessageInDB(
            ticket_id=str(ticket_dict["_id"]),
            sender_id=str(current_user["_id"]),
            message=request.message,
            timestamp=datetime.utcnow()
        )
        msg_dict = init_msg.dict(by_alias=True)
        msg_dict["_id"] = ObjectId()
        await messages_col.insert_one(msg_dict)
        
        # Cast inner _id back to string for Pydantic response validation
        ticket_dict["_id"] = str(ticket_dict["_id"])
        return ticket_dict
    except Exception as e:
        import logging
        logging.error(f"Error in create_ticket: {str(e)}")
        print(f"CRITICAL ERROR in create_ticket: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

@router.get("/tickets/me", response_model=List[TicketResponse])
async def get_my_tickets(current_user: dict = Depends(get_current_user)):
    try:
        tickets_col = get_tickets_collection()
        cursor = tickets_col.find({"user_id": str(current_user["_id"])}).sort("updated_at", -1)
        tickets = await cursor.to_list(length=100)
        for t in tickets: t["_id"] = str(t["_id"])
        return tickets
    except Exception as e:
        import logging
        logging.error(f"Error in get_my_tickets: {str(e)}")
        print(f"CRITICAL ERROR in get_my_tickets: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/tickets/{ticket_id}/messages", response_model=List[TicketMessageResponse])
async def get_ticket_messages(
    ticket_id: str,
    current_user: dict = Depends(get_current_user)
):
    try:
        tickets_col = get_tickets_collection()
        messages_col = get_ticket_messages_collection()
        
        ticket = await tickets_col.find_one({"_id": ObjectId(ticket_id)})
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")
            
        is_admin_user = current_user.get("role") in [UserRole.ADMIN.value, UserRole.SUPER_ADMIN.value, "admin", "super_admin"]
        if ticket["user_id"] != str(current_user["_id"]) and not is_admin_user:
            raise HTTPException(status_code=403, detail="Not authorized to view this ticket")
            
        cursor = messages_col.find({"ticket_id": ticket_id}).sort("timestamp", 1)
        messages = await cursor.to_list(length=500)
        for m in messages: m["_id"] = str(m["_id"])
        return messages
    except HTTPException:
        raise
    except Exception as e:
        import logging
        logging.error(f"Error in get_ticket_messages: {str(e)}")
        print(f"CRITICAL ERROR in get_ticket_messages: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/tickets/{ticket_id}/messages", response_model=TicketMessageResponse)
async def send_ticket_message(
    ticket_id: str,
    request: TicketMessageCreate,
    current_user: dict = Depends(get_current_user)
):
    try:
        tickets_col = get_tickets_collection()
        messages_col = get_ticket_messages_collection()
        
        ticket = await tickets_col.find_one({"_id": ObjectId(ticket_id)})
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")
            
        is_admin_user = current_user.get("role") in [UserRole.ADMIN.value, UserRole.SUPER_ADMIN.value, "admin", "super_admin"]
        if ticket["user_id"] != str(current_user["_id"]) and not is_admin_user:
            raise HTTPException(status_code=403, detail="Not authorized to message on this ticket")
            
        if ticket["status"] == "closed":
            raise HTTPException(status_code=400, detail="Cannot send messages on a closed ticket")
            
        new_msg = TicketMessageInDB(
            ticket_id=ticket_id,
            sender_id=str(current_user["_id"]),
            message=request.message,
            timestamp=datetime.utcnow()
        )
        msg_dict = new_msg.dict(by_alias=True)
        msg_dict["_id"] = ObjectId()
        await messages_col.insert_one(msg_dict)
        
        await tickets_col.update_one(
            {"_id": ObjectId(ticket_id)},
            {"$set": {"updated_at": datetime.utcnow()}}
        )
        
        msg_dict["_id"] = str(msg_dict["_id"])
        return msg_dict
    except HTTPException:
        raise
    except Exception as e:
        import logging
        logging.error(f"Error in send_ticket_message: {str(e)}")
        print(f"CRITICAL ERROR in send_ticket_message: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/tickets/{ticket_id}/close", response_model=TicketResponse)
async def close_ticket(
    ticket_id: str,
    current_user: dict = Depends(get_current_user)
):
    try:
        is_admin(current_user)
        tickets_col = get_tickets_collection()
        
        result = await tickets_col.find_one_and_update(
            {"_id": ObjectId(ticket_id)},
            {"$set": {"status": "closed", "updated_at": datetime.utcnow()}},
            return_document=True
        )
        
        if not result:
            raise HTTPException(status_code=404, detail="Ticket not found")
            
        result["_id"] = str(result["_id"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        print(f"CRITICAL ERROR in close_ticket: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/tickets/{ticket_id}/request-reopen", response_model=TicketResponse)
async def request_reopen(
    ticket_id: str,
    request: ReopenRequest,
    current_user: dict = Depends(get_current_user)
):
    try:
        tickets_col = get_tickets_collection()
        
        ticket = await tickets_col.find_one({"_id": ObjectId(ticket_id)})
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")
            
        if ticket["user_id"] != str(current_user["_id"]):
            raise HTTPException(status_code=403, detail="Not authorized to reopen this ticket")
            
        if ticket["status"] != "closed":
            raise HTTPException(status_code=400, detail="Only closed tickets can be reopened")
            
        result = await tickets_col.find_one_and_update(
            {"_id": ObjectId(ticket_id)},
            {"$set": {
                "status": "reopen_requested", 
                "reopen_reason": request.reason,
                "updated_at": datetime.utcnow()
            }},
            return_document=True
        )
        result["_id"] = str(result["_id"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        import logging
        logging.error(f"Error in request_reopen: {str(e)}")
        print(f"CRITICAL ERROR in request_reopen: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/admin/tickets", response_model=List[TicketResponse])
async def get_all_tickets(current_user: dict = Depends(get_current_user)):
    try:
        is_admin(current_user)
        tickets_col = get_tickets_collection()
        
        cursor = tickets_col.find({}).sort([
            ("status", -1), 
            ("updated_at", -1)
        ])
        tickets = await cursor.to_list(length=500)
        for t in tickets: t["_id"] = str(t["_id"])
        return tickets
    except HTTPException:
        raise
    except Exception as e:
        import logging
        logging.error(f"Error in get_all_tickets: {str(e)}")
        print(f"CRITICAL ERROR in get_all_tickets: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
