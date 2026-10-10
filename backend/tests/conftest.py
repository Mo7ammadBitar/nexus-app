"""
Shared test fixtures.

Uses a REAL local MongoDB with a throwaway database.
pytest-asyncio 1.4.0 strict mode requires every async fixture to be marked.
"""
import random
import string
import pytest
import pytest_asyncio
import motor.motor_asyncio

from app.database import Database


DB_NAME = "nexus_test_" + "".join(random.choices(string.ascii_lowercase + string.digits, k=8))


@pytest_asyncio.fixture(autouse=True)
async def test_db():
    """
    Point Database.db at a real throwaway test database.
    Creates a fresh Motor client per test (each test has its own event loop).
    Drops all collections between each test for isolation.
    """
    client = motor.motor_asyncio.AsyncIOMotorClient("mongodb://localhost:27017")
    db = client[DB_NAME]
    Database.client = client
    Database.db = db

    # Create the unique index on payments.order_id that the production code expects
    await db.payments.create_index("order_id", unique=True)

    yield db

    # Drop all collections after each test for isolation
    import pymongo
    sync_client = pymongo.MongoClient("mongodb://localhost:27017")
    sync_db = sync_client[DB_NAME]
    for name in sync_db.list_collection_names():
        sync_db.drop_collection(name)
    sync_client.close()
    
    try:
        client.close()
    except Exception:
        pass


def pytest_sessionfinish(session, exitstatus):
    """Drop the throwaway database after the entire session."""
    import pymongo
    sync_client = pymongo.MongoClient("mongodb://localhost:27017")
    sync_client.drop_database(DB_NAME)
    sync_client.close()
