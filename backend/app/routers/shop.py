"""
Shop Routes - Relic Catalog, Purchase, Equip/Unequip
"""
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from datetime import datetime
from bson import ObjectId

from app.middleware.auth import get_current_user
from app.database import get_users_collection, get_servers_collection

router = APIRouter(prefix="/shop", tags=["Shop"])

# ============ Relics Catalog (Hardcoded) ============
RELICS_CATALOG = [
    {
        "id": "frame_celestial",
        "name": "Celestial Frame",
        "type": "frame",
        "price": 150,
        "description": "A shimmering celestial border around your avatar.",
        "css_class": "relic-frame-celestial",
        "preview_color": "#7c3aed"
    },
    {
        "id": "frame_infernal",
        "name": "Infernal Frame",
        "type": "frame",
        "price": 200,
        "description": "Flames of the underworld encircle your presence.",
        "css_class": "relic-frame-infernal",
        "preview_color": "#ef4444"
    },
    {
        "id": "frame_frost",
        "name": "Frostbound Frame",
        "type": "frame",
        "price": 150,
        "description": "An icy crystalline border radiating cold energy.",
        "css_class": "relic-frame-frost",
        "preview_color": "#06b6d4"
    },
    {
        "id": "frame_verdant",
        "name": "Verdant Frame",
        "type": "frame",
        "price": 100,
        "description": "Nature's embrace woven into living vines.",
        "css_class": "relic-frame-verdant",
        "preview_color": "#10b981"
    },
    {
        "id": "frame_astral_vortex",
        "name": "Astral Vortex",
        "type": "frame",
        "price": 500,
        "description": "A spinning cosmic gradient frame.",
        "css_class": "frame-astral-vortex",
        "preview_color": "#8f00ff"
    },
    {
        "id": "frame_neon_pulse",
        "name": "Neon Pulse",
        "type": "frame",
        "price": 450,
        "description": "A pulsating neon cyber frame.",
        "css_class": "frame-neon-pulse",
        "preview_color": "#00ffa6"
    },
    {
        "id": "frame_inferno_ring",
        "name": "Inferno Ring",
        "type": "frame",
        "price": 500,
        "description": "A blazing, animated fire ring.",
        "css_class": "frame-inferno-ring",
        "preview_color": "#ff4500"
    },
    {
        "id": "bubble_ethereal",
        "name": "Ethereal Bubble",
        "type": "bubble",
        "price": 200,
        "description": "Your messages float in an otherworldly glow.",
        "css_class": "relic-bubble-ethereal",
        "preview_color": "#8b5cf6"
    },
    {
        "id": "bubble_shadow",
        "name": "Shadow Bubble",
        "type": "bubble",
        "price": 250,
        "description": "Messages emerge from the void itself.",
        "css_class": "relic-bubble-shadow",
        "preview_color": "#1e1b4b"
    },
    {
        "id": "bubble_golden",
        "name": "Golden Bubble",
        "type": "bubble",
        "price": 300,
        "description": "Words inscribed on golden ethereal parchment.",
        "css_class": "relic-bubble-golden",
        "preview_color": "#f59e0b"
    },
    {
        "id": "bubble_aurora",
        "name": "Aurora Bubble",
        "type": "bubble",
        "price": 200,
        "description": "Northern lights dance around your messages.",
        "css_class": "relic-bubble-aurora",
        "preview_color": "#06b6d4"
    },
    {
        "id": "bubble_astral_vortex",
        "name": "Astral Vortex Bubble",
        "type": "bubble",
        "price": 500,
        "description": "A message bubble with a shifting cosmic glow.",
        "css_class": "bubble-astral-vortex",
        "preview_color": "#8f00ff"
    },
    {
        "id": "bubble_neon_pulse",
        "name": "Neon Pulse Bubble",
        "type": "bubble",
        "price": 450,
        "description": "A message bubble with a rhythmic neon pulse.",
        "css_class": "bubble-neon-pulse",
        "preview_color": "#00ffa6"
    },
    {
        "id": "bubble_inferno_ring",
        "name": "Inferno Ring Bubble",
        "type": "bubble",
        "price": 500,
        "description": "A message bubble with a soft, flickering fiery aura.",
        "css_class": "bubble-inferno-ring",
        "preview_color": "#ff4500"
    },
]


@router.get("/relics")
async def get_relics_catalog(current_user: dict = Depends(get_current_user)):
    """Return the full relics catalog with ownership status."""
    owned = current_user.get("owned_relics", []) or []
    equipped = current_user.get("equipped_relics", {}) or {}

    catalog = []
    for relic in RELICS_CATALOG:
        item = {**relic}
        item["owned"] = relic["id"] in owned
        item["equipped"] = relic["id"] in equipped.values()
        catalog.append(item)

    return {
        "relics": catalog,
        "aether_shards": current_user.get("aether_shards", 0) or 0
    }


@router.post("/buy/{relic_id}")
async def buy_relic(relic_id: str, current_user: dict = Depends(get_current_user)):
    """Purchase a relic with Aether Shards."""
    # Find relic in catalog
    relic = next((r for r in RELICS_CATALOG if r["id"] == relic_id), None)
    if not relic:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Relic not found in the catalog."
        )

    # Check if already owned
    owned = current_user.get("owned_relics", []) or []
    if relic_id in owned:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already own this relic."
        )

    # Check balance
    current_shards = current_user.get("aether_shards", 0) or 0
    if current_shards < relic["price"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient Aether Shards. Need {relic['price']}, have {current_shards}."
        )

    # Deduct and add
    new_balance = current_shards - relic["price"]
    owned.append(relic_id)

    users = get_users_collection()
    await users.update_one(
        {"_id": ObjectId(current_user["_id"])},
        {
            "$set": {
                "aether_shards": new_balance,
                "owned_relics": owned,
                "updated_at": datetime.utcnow()
            }
        }
    )

    return {
        "message": f"Attuned to {relic['name']}!",
        "relic": relic,
        "new_balance": new_balance,
        "owned_relics": owned
    }


@router.post("/equip/{relic_id}")
async def equip_relic(relic_id: str, current_user: dict = Depends(get_current_user)):
    """Equip an owned relic to the appropriate slot."""
    # Find relic
    relic = next((r for r in RELICS_CATALOG if r["id"] == relic_id), None)
    if not relic:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Relic not found."
        )

    # Check ownership
    owned = current_user.get("owned_relics", []) or []
    if relic_id not in owned:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You don't own this relic."
        )

    # Equip to the correct slot
    equipped = current_user.get("equipped_relics", {}) or {}
    slot = relic["type"]  # "frame" or "bubble"
    equipped[slot] = relic_id

    users = get_users_collection()
    await users.update_one(
        {"_id": ObjectId(current_user["_id"])},
        {
            "$set": {
                "equipped_relics": equipped,
                "updated_at": datetime.utcnow()
            }
        }
    )

    return {
        "message": f"{relic['name']} equipped to {slot} slot!",
        "equipped_relics": equipped
    }


@router.post("/unequip/{slot}")
async def unequip_relic(slot: str, current_user: dict = Depends(get_current_user)):
    """Remove a relic from a slot (frame or bubble)."""
    if slot not in ("frame", "bubble"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid slot. Must be 'frame' or 'bubble'."
        )

    equipped = current_user.get("equipped_relics", {}) or {}
    if slot not in equipped:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No relic equipped in {slot} slot."
        )

    del equipped[slot]

    users = get_users_collection()
    await users.update_one(
        {"_id": ObjectId(current_user["_id"])},
        {
            "$set": {
                "equipped_relics": equipped,
                "updated_at": datetime.utcnow()
            }
        }
    )

    return {
        "message": f"{slot.capitalize()} slot cleared!",
        "equipped_relics": equipped
    }


@router.get("/inventory")
async def get_inventory(current_user: dict = Depends(get_current_user)):
    """Get user's owned relics with full details and equipped status."""
    owned_ids = current_user.get("owned_relics", []) or []
    equipped = current_user.get("equipped_relics", {}) or {}

    owned_relics = []
    for relic in RELICS_CATALOG:
        if relic["id"] in owned_ids:
            item = {**relic}
            item["equipped"] = relic["id"] in equipped.values()
            item["equipped_slot"] = next(
                (slot for slot, rid in equipped.items() if rid == relic["id"]),
                None
            )
            owned_relics.append(item)

    return {
        "owned_relics": owned_relics,
        "equipped_relics": equipped,
        "aether_shards": current_user.get("aether_shards", 0) or 0
    }


# ============ Server Boost ============

BOOST_COST = 1000  # Aether Shards


class ServerBoostRequest(BaseModel):
    """Buy a server boost"""
    server_id: str


@router.post("/buy-server-boost")
async def buy_server_boost(
    request: ServerBoostRequest,
    current_user: dict = Depends(get_current_user)
):
    """Purchase a permanent Server Boost for 1000 Aether Shards."""
    # Check shard balance
    current_shards = current_user.get("aether_shards", 0) or 0
    if current_shards < BOOST_COST:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient Aether Shards. Need {BOOST_COST}, have {current_shards}."
        )

    # Verify server exists
    servers = get_servers_collection()
    server = await servers.find_one({"_id": ObjectId(request.server_id)})
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Server not found"
        )

    # Deduct shards from user
    new_balance = current_shards - BOOST_COST
    users = get_users_collection()
    await users.update_one(
        {"_id": ObjectId(current_user["_id"])},
        {"$set": {"aether_shards": new_balance, "updated_at": datetime.utcnow()}}
    )

    # Increment server boost level
    updated_server = await servers.find_one_and_update(
        {"_id": ObjectId(request.server_id)},
        {
            "$inc": {"boost_level": 1},
            "$set": {"updated_at": datetime.utcnow()},
        },
        return_document=True
    )

    return {
        "message": f"Server boosted! {server['name']} is now Boost Level {updated_server['boost_level']}!",
        "new_balance": new_balance,
        "boost_level": updated_server["boost_level"],
        "server_id": request.server_id,
    }

