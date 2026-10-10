"""
Payments Router — Server-Side PayPal Order Management

Flow:
  1. Frontend asks backend to create an order (/create-order).
  2. Backend calls PayPal's API to create the order and stores it in the DB.
  3. Backend returns order_id to frontend.
  4. Frontend approves payment in the PayPal popup.
  5. Frontend tells backend to verify the order.
  6. Backend captures the order on PayPal, checks amounts against DB record, and credits users safely.
"""

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId
from pydantic import BaseModel
from datetime import datetime, timedelta

from app.database import get_users_collection, get_payments_collection
from app.middleware.auth import get_current_user
from app.config import get_settings

settings = get_settings()
router = APIRouter(prefix="/payments", tags=["payments"])

# ---- Product Catalog ----
SHARD_PACKS = {
    "pack_small":  {"shards": 100,  "price": 0.99, "type": "shards"},
    "pack_medium": {"shards": 550,  "price": 4.99, "type": "shards"},
    "pack_large":  {"shards": 1200, "price": 9.99, "type": "shards"},
}

ELITE_PLANS = {
    "monthly": {"price": 4.99,  "duration": timedelta(days=30), "type": "elite"},
    "yearly":  {"price": 49.90, "duration": timedelta(days=365), "type": "elite"},
}

def get_item_from_catalog(item_id: str):
    if item_id in SHARD_PACKS:
        return SHARD_PACKS[item_id]
    if item_id in ELITE_PLANS:
        return ELITE_PLANS[item_id]
    return None

# ---- PayPal API Helpers ----
def _paypal_base_url() -> str:
    if settings.paypal_sandbox:
        return "https://api-m.sandbox.paypal.com"
    return "https://api-m.paypal.com"

async def _get_paypal_access_token() -> str:
    url = f"{_paypal_base_url()}/v1/oauth2/token"
    async with httpx.AsyncClient() as client:
        response = await client.post(
            url,
            data={"grant_type": "client_credentials"},
            auth=(settings.paypal_client_id, settings.paypal_client_secret),
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
    if response.status_code != 200:
        print(f"❌ PayPal auth failed: {response.text}")
        raise HTTPException(status_code=502, detail="PayPal authentication failed")
    return response.json()["access_token"]

async def _create_paypal_order(amount: float) -> str:
    token = await _get_paypal_access_token()
    url = f"{_paypal_base_url()}/v2/checkout/orders"
    payload = {
        "intent": "CAPTURE",
        "purchase_units": [{
            "amount": {
                "currency_code": "USD",
                "value": f"{amount:.2f}"
            }
        }]
    }
    async with httpx.AsyncClient() as client:
        response = await client.post(
            url,
            json=payload,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
        )
    if response.status_code not in (200, 201):
        print(f"❌ PayPal order creation failed: {response.text}")
        raise HTTPException(status_code=400, detail="Failed to create PayPal order")
    return response.json()["id"]

async def _capture_paypal_order(order_id: str) -> dict:
    token = await _get_paypal_access_token()
    url = f"{_paypal_base_url()}/v2/checkout/orders/{order_id}/capture"
    async with httpx.AsyncClient() as client:
        response = await client.post(
            url,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
        )
    if response.status_code not in (200, 201):
        resp_data = response.json()
        if any(issue.get("issue") == "ORDER_ALREADY_CAPTURED" for issue in resp_data.get("details", [])):
            get_url = f"{_paypal_base_url()}/v2/checkout/orders/{order_id}"
            async with httpx.AsyncClient() as client:
                get_resp = await client.get(
                    get_url,
                    headers={"Authorization": f"Bearer {token}"}
                )
            if get_resp.status_code == 200:
                return get_resp.json()
        
        print(f"❌ PayPal capture failed: {response.text}")
        raise HTTPException(status_code=400, detail="PayPal order capture failed")
    return response.json()

# ---- Request Schemas ----
class CreateOrderRequest(BaseModel):
    item_id: str

class VerifyPaymentRequest(BaseModel):
    order_id: str

# ---- Endpoints ----

@router.post("/create-order")
async def create_order(
    request: CreateOrderRequest,
    current_user: dict = Depends(get_current_user),
):
    item = get_item_from_catalog(request.item_id)
    if not item:
        raise HTTPException(status_code=400, detail="Unknown item ID")
    
    order_id = await _create_paypal_order(item["price"])
    
    payments = get_payments_collection()
    import pymongo.errors
    try:
        await payments.insert_one({
            "order_id": order_id,
            "user_id": current_user["_id"],
            "pack_id": request.item_id,
            "expected_amount": item["price"],
            "currency": "USD",
            "status": "created",
            "type": item["type"],
            "created_at": datetime.utcnow()
        })
    except pymongo.errors.DuplicateKeyError:
        raise HTTPException(status_code=409, detail="Order ID already exists in system")
    
    return {"order_id": order_id}


@router.post("/verify-shards")
async def verify_shard_purchase(
    request: VerifyPaymentRequest,
    current_user: dict = Depends(get_current_user),
):
    payments = get_payments_collection()
    
    # Require record exists and belongs to current user
    record = await payments.find_one({"order_id": request.order_id})
    if not record:
        raise HTTPException(status_code=404, detail="Order not found")
    if record["user_id"] != current_user["_id"]:
        raise HTTPException(status_code=403, detail="Order belongs to another user")
    
    if record.get("status") == "completed":
        return {"status": "success", "message": "Payment already processed", "already_processed": True}

    if record.get("type") != "shards":
        raise HTTPException(status_code=400, detail="Invalid order type")
        
    expected_amount = record["expected_amount"]
    pack_id = record["pack_id"]
    pack = SHARD_PACKS[pack_id]

    order = await _capture_paypal_order(request.order_id)

    if order.get("status") != "COMPLETED":
        raise HTTPException(status_code=400, detail="Payment not completed")

    try:
        capture_unit = order["purchase_units"][0]["payments"]["captures"][0]
    except (KeyError, IndexError):
        raise HTTPException(status_code=400, detail="Invalid PayPal order format")

    if capture_unit.get("status") != "COMPLETED":
        raise HTTPException(status_code=400, detail="Payment capture not completed")

    paid_amount = float(capture_unit["amount"]["value"])
    paid_currency = capture_unit["amount"]["currency_code"]

    if paid_currency != "USD":
        raise HTTPException(status_code=400, detail="Invalid currency")
    # Must match expected amount exactly
    if paid_amount != expected_amount:
        raise HTTPException(
            status_code=400,
            detail=f"Amount mismatch: paid ${paid_amount}, expected ${expected_amount}",
        )

    # 1. Atomic credit with idempotency marker
    users = get_users_collection()
    update_result = await users.update_one(
        {
            "_id": ObjectId(current_user["_id"]),
            "paid_orders": {"$ne": request.order_id}
        },
        {
            "$inc": {"aether_shards": pack["shards"]},
            "$push": {"paid_orders": request.order_id}
        }
    )
    
    # 2. Bookkeeping
    await payments.update_one(
        {"order_id": request.order_id},
        {"$set": {"status": "completed", "completed_at": datetime.utcnow()}}
    )
    
    if update_result.modified_count == 0:
        return {"status": "success", "message": "Payment already processed", "already_processed": True}

    user_result = await users.find_one({"_id": ObjectId(current_user["_id"])})

    return {
        "status": "success",
        "message": f"Successfully purchased {pack['shards']} Shards!",
        "new_balance": user_result["aether_shards"],
        "shards_added": pack["shards"],
    }


@router.post("/verify-elite")
async def verify_elite_subscription(
    request: VerifyPaymentRequest,
    current_user: dict = Depends(get_current_user),
):
    payments = get_payments_collection()
    
    # Require record exists and belongs to current user
    record = await payments.find_one({"order_id": request.order_id})
    if not record:
        raise HTTPException(status_code=404, detail="Order not found")
    if record["user_id"] != current_user["_id"]:
        raise HTTPException(status_code=403, detail="Order belongs to another user")
        
    if record.get("status") == "completed":
        return {"status": "success", "message": "Payment already processed", "already_processed": True}

    if record.get("type") != "elite":
        raise HTTPException(status_code=400, detail="Invalid order type")

    expected_amount = record["expected_amount"]
    plan_id = record["pack_id"]
    plan = ELITE_PLANS[plan_id]

    order = await _capture_paypal_order(request.order_id)

    if order.get("status") != "COMPLETED":
        raise HTTPException(status_code=400, detail="Payment not completed")

    try:
        capture_unit = order["purchase_units"][0]["payments"]["captures"][0]
    except (KeyError, IndexError):
        raise HTTPException(status_code=400, detail="Invalid PayPal order format")
        
    if capture_unit.get("status") != "COMPLETED":
        raise HTTPException(status_code=400, detail="Payment capture not completed")

    paid_amount = float(capture_unit["amount"]["value"])
    paid_currency = capture_unit["amount"]["currency_code"]

    if paid_currency != "USD":
        raise HTTPException(status_code=400, detail="Invalid currency")
    if paid_amount != expected_amount:
        raise HTTPException(
            status_code=400,
            detail=f"Amount mismatch: paid ${paid_amount}, expected ${expected_amount}",
        )

    # 1. Atomic credit with idempotency marker
    users = get_users_collection()
    now = datetime.utcnow()
    expires_at = now + plan["duration"]
    
    update_result = await users.update_one(
        {
            "_id": ObjectId(current_user["_id"]),
            "paid_orders": {"$ne": request.order_id}
        },
        {
            "$set": {
                "is_premium": True,
                "premium_plan": plan_id,
                "premium_since": now,
                "premium_expires_at": expires_at,
            },
            "$push": {"paid_orders": request.order_id}
        }
    )
    
    # 2. Bookkeeping
    await payments.update_one(
        {"order_id": request.order_id},
        {"$set": {"status": "completed", "completed_at": datetime.utcnow()}}
    )
    
    if update_result.modified_count == 0:
        return {"status": "success", "message": "Payment already processed", "already_processed": True}

    return {
        "status": "success",
        "message": "Welcome to Nexus Elite! All features unlocked.",
        "is_premium": True,
        "premium_plan": plan_id,
        "subscribed_at": now.isoformat(),
        "premium_expires_at": expires_at.isoformat(),
    }
