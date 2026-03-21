"""
Payments Router — Server-Side PayPal Order Verification

Flow:
  1. Frontend creates a PayPal order (client-side SDK).
  2. User approves payment in the PayPal popup.
  3. Frontend sends the orderID + packId/plan to our backend.
  4. Backend calls PayPal's REST API to VERIFY the order is COMPLETED
     and the amount matches what we expect.
  5. Only then do we credit Aether Shards or activate Nexus Elite.
"""

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId
from pydantic import BaseModel
from datetime import datetime, timedelta

from app.database import get_users_collection
from app.middleware.auth import get_current_user
from app.config import get_settings

settings = get_settings()
router = APIRouter(prefix="/payments", tags=["payments"])

# ---- Product Catalog ----
SHARD_PACKS = {
    "pack_small":  {"shards": 100,  "price": 0.99},
    "pack_medium": {"shards": 550,  "price": 4.99},
    "pack_large":  {"shards": 1200, "price": 9.99},
}

ELITE_PLANS = {
    "monthly": {"price": 4.99,  "duration": timedelta(days=30)},
    "yearly":  {"price": 49.90, "duration": timedelta(days=365)},
}


# ---- PayPal API Helpers ----
def _paypal_base_url() -> str:
    """Return the correct PayPal API base depending on sandbox mode."""
    if settings.paypal_sandbox:
        return "https://api-m.sandbox.paypal.com"
    return "https://api-m.paypal.com"


async def _get_paypal_access_token() -> str:
    """
    Authenticate with PayPal using Client Credentials (OAuth 2.0).
    Returns a Bearer access token.
    """
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


async def _capture_paypal_order(order_id: str) -> dict:
    """
    Capture a PayPal order and return the full order details.
    This is the server-side capture that actually finalises the payment.
    """
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
        print(f"❌ PayPal capture failed: {response.text}")
        raise HTTPException(status_code=400, detail="PayPal order capture failed")
    return response.json()


# ---- Request Schemas ----
class VerifyShardPurchaseRequest(BaseModel):
    order_id: str
    pack_id: str

class VerifyEliteSubscribeRequest(BaseModel):
    order_id: str
    plan: str  # "monthly" or "yearly"


# ---- Endpoints ----

@router.post("/verify-shards")
async def verify_shard_purchase(
    request: VerifyShardPurchaseRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Verify a PayPal order for an Aether Shard purchase.
    Only credits the user AFTER PayPal confirms COMPLETED + correct amount.
    """
    # Validate pack
    if request.pack_id not in SHARD_PACKS:
        raise HTTPException(status_code=400, detail="Invalid pack ID")
    pack = SHARD_PACKS[request.pack_id]

    # Capture the order on PayPal's servers
    order = await _capture_paypal_order(request.order_id)

    # Verify status
    if order.get("status") != "COMPLETED":
        raise HTTPException(status_code=400, detail="Payment not completed")

    # Verify the amount matches what we expect
    capture_unit = order["purchase_units"][0]["payments"]["captures"][0]
    paid_amount = float(capture_unit["amount"]["value"])
    paid_currency = capture_unit["amount"]["currency_code"]

    if paid_currency != "USD":
        raise HTTPException(status_code=400, detail="Invalid currency")
    if paid_amount < pack["price"]:
        raise HTTPException(
            status_code=400,
            detail=f"Amount mismatch: paid ${paid_amount}, expected ${pack['price']}",
        )

    # All checks passed — credit the user
    users = get_users_collection()
    result = await users.find_one_and_update(
        {"_id": ObjectId(current_user["_id"])},
        {"$inc": {"aether_shards": pack["shards"]}},
        return_document=True,
    )

    return {
        "status": "success",
        "message": f"Successfully purchased {pack['shards']} Shards!",
        "new_balance": result["aether_shards"],
        "shards_added": pack["shards"],
    }


@router.post("/verify-elite")
async def verify_elite_subscription(
    request: VerifyEliteSubscribeRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Verify a PayPal order for a Nexus Elite subscription.
    Only activates premium AFTER PayPal confirms COMPLETED + correct amount.
    """
    if request.plan not in ELITE_PLANS:
        raise HTTPException(status_code=400, detail="Invalid plan")
    plan = ELITE_PLANS[request.plan]

    # Capture the order on PayPal's servers
    order = await _capture_paypal_order(request.order_id)

    # Verify status
    if order.get("status") != "COMPLETED":
        raise HTTPException(status_code=400, detail="Payment not completed")

    # Verify amount
    capture_unit = order["purchase_units"][0]["payments"]["captures"][0]
    paid_amount = float(capture_unit["amount"]["value"])
    if paid_amount < plan["price"]:
        raise HTTPException(
            status_code=400,
            detail=f"Amount mismatch: paid ${paid_amount}, expected ${plan['price']}",
        )

    # Activate Premium
    users = get_users_collection()
    now = datetime.utcnow()
    expires_at = now + plan["duration"]

    updated_user = await users.find_one_and_update(
        {"_id": ObjectId(current_user["_id"])},
        {
            "$set": {
                "is_premium": True,
                "premium_plan": request.plan,
                "premium_since": now,
                "premium_expires_at": expires_at,
            }
        },
        return_document=True,
    )

    return {
        "status": "success",
        "message": "Welcome to Nexus Elite! All features unlocked.",
        "is_premium": True,
        "premium_plan": request.plan,
        "subscribed_at": now.isoformat(),
        "premium_expires_at": expires_at.isoformat(),
    }
