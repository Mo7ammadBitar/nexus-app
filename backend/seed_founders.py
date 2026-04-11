"""
One-time migration script to seed the Founder badge for the first 100 users.

Connects to MongoDB, sorts users by created_at ascending, takes the first 100,
and sets is_founder=True + adds 'founder' to owned_badges.

Usage:
    python seed_founders.py

Requires MONGO_URL environment variable (or update the connection string below).
"""
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URL = os.environ.get("MONGO_URL", "mongodb+srv://<your-connection-string>")
DB_NAME = os.environ.get("MONGO_DB_NAME", "nexus")
FOUNDER_LIMIT = 100


async def seed_founders():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    users = db["users"]

    # Find the first 100 users by creation date
    cursor = users.find(
        {"is_deleted": {"$ne": True}},
        {"_id": 1, "username": 1, "created_at": 1}
    ).sort("created_at", 1).limit(FOUNDER_LIMIT)

    founder_ids = []
    async for user in cursor:
        founder_ids.append(user["_id"])
        print(f"  🏅 Founder: {user.get('username', 'unknown')} (created: {user.get('created_at', 'N/A')})")

    if not founder_ids:
        print("⚠️  No users found in database.")
        client.close()
        return

    # Bulk update: set is_founder=True and add 'founder' to owned_badges
    result = await users.update_many(
        {"_id": {"$in": founder_ids}},
        {
            "$set": {"is_founder": True},
            "$addToSet": {"owned_badges": "founder"},
        },
    )

    print(f"\n✅ Founder badge seeded for {result.modified_count} / {len(founder_ids)} users.")
    client.close()


if __name__ == "__main__":
    asyncio.run(seed_founders())
