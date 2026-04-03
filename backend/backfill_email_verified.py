"""
One-time migration script to backfill `is_email_verified` for legacy accounts.

Run this once against your MongoDB to ensure all existing users have the field.
- Admin/Super Admin/System roles → default to True
- Regular users without the field → default to False

Usage:
    python backfill_email_verified.py

Requires MONGO_URL environment variable (or update the connection string below).
"""
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URL = os.environ.get("MONGO_URL", "mongodb+srv://<your-connection-string>")
DB_NAME = os.environ.get("MONGO_DB_NAME", "nexus")

PRIVILEGED_ROLES = {"admin", "super_admin", "system"}


async def backfill():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    users = db["users"]

    # 1. Set is_email_verified = True for privileged roles that are missing the field
    result_privileged = await users.update_many(
        {
            "role": {"$in": list(PRIVILEGED_ROLES)},
            "is_email_verified": {"$exists": False},
        },
        {"$set": {"is_email_verified": True}},
    )
    print(f"✅ Privileged accounts backfilled: {result_privileged.modified_count}")

    # 2. Set is_email_verified = False for regular users missing the field
    result_regular = await users.update_many(
        {
            "role": {"$nin": list(PRIVILEGED_ROLES)},
            "is_email_verified": {"$exists": False},
        },
        {"$set": {"is_email_verified": False}},
    )
    print(f"✅ Regular accounts backfilled: {result_regular.modified_count}")

    # Summary
    total = result_privileged.modified_count + result_regular.modified_count
    print(f"\n🎯 Total documents updated: {total}")

    client.close()


if __name__ == "__main__":
    asyncio.run(backfill())
