"""
Nexus Backend - Main Application Entry Point
With Socket.IO integration for real-time features
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import socketio
import os

from app.config import get_settings
from app.database import Database
from app.routers import auth_router, users_router, servers_router, friends_router, dm_router, admin_router, messages_router, starred_router, preview_router, search_router, economy_router, shop_router, oracle_router, payments_router, debug_router, support_router, quests_router, games_router
from app.sockets import ChatNamespace, VoiceNamespace

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.
    Handles startup and shutdown events.
    """
    # Startup
    print("🚀 Starting Nexus Backend...")
    
    # Connect to MongoDB
    await Database.connect()
    
    # Seed super admin
    await seed_super_admin_on_startup()
    
    # Seed The Oracle system bot
    from app.services.oracle_service import OracleService
    await OracleService.seed_oracle()
    
    yield
    
    # Shutdown
    await Database.disconnect()
    print("👋 Nexus Backend shutdown complete")


async def seed_super_admin_on_startup():
    """Seed super admin on application startup"""
    from app.database import get_users_collection
    from app.utils.security import hash_password
    from app.models.user import UserRole, AvatarType, BannerType
    from datetime import datetime
    
    users = get_users_collection()
    
    # Check if super admin exists (by email OR username)
    existing = await users.find_one({
        "$or": [
            {"email": settings.super_admin_email},
            {"username": settings.super_admin_username}
        ]
    })
    
    if existing:
        # Backfill is_email_verified for legacy super admin accounts
        if not existing.get("is_email_verified"):
            await users.update_one(
                {"_id": existing["_id"]},
                {"$set": {"is_email_verified": True}}
            )
            print(f"✅ Super Admin backfilled is_email_verified: {existing.get('username', settings.super_admin_username)}")
        print(f"✅ Super Admin exists: {existing.get('username', settings.super_admin_username)}")
        return
    
    try:
        # Create super admin
        super_admin = {
            "username": settings.super_admin_username,
            "email": settings.super_admin_email,
            "password_hash": hash_password(settings.super_admin_password),
            "display_name": settings.super_admin_username,
            "role": UserRole.SUPER_ADMIN.value,
            "avatar_url": None,
            "avatar_type": AvatarType.STATIC.value,
            "banner_url": None,
            "banner_type": BannerType.SOLID.value,
            "bio": "System Administrator",
            "is_premium": True,
            "is_email_verified": True,
            "is_banned": False,
            "ban_reason": None,
            "ban_expires_at": None,
            "is_deleted": False,
            "created_by": None,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
        
        await users.insert_one(super_admin)
        print(f"🔐 Super Admin created: {settings.super_admin_username}")
    except Exception as e:
        print(f"⚠️ Super Admin setup: {str(e)}")


# Import shared Socket.IO instance
from app.socket_instance import sio

# Register namespaces
sio.register_namespace(ChatNamespace("/chat"))
sio.register_namespace(VoiceNamespace("/voice"))

# Create Socket.IO ASGI app
socket_app = socketio.ASGIApp(sio, socketio_path="socket.io")

# Create FastAPI application
app = FastAPI(
    title="Nexus API",
    description="Voice & Text Chat Application for MENA Region",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Middleware — must list explicit origins when credentials are used
ALLOWED_ORIGINS = [
    "http://localhost:3000",   # React dev server
    "http://localhost:5000",   # Alternate dev
    "https://try-nexus.vercel.app",  # Vercel production
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create uploads directory
uploads_dir = os.path.abspath(settings.upload_dir)
os.makedirs(uploads_dir, exist_ok=True)

# Mount static files for uploads
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

# Create static directory for branding assets
static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "static")
os.makedirs(static_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Mount Socket.IO
app.mount("/socket.io", socket_app)

# Include routers
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(servers_router)
app.include_router(friends_router)
app.include_router(dm_router)
app.include_router(admin_router)
app.include_router(messages_router)
app.include_router(starred_router)
app.include_router(preview_router)
app.include_router(search_router)
app.include_router(economy_router)
app.include_router(shop_router)
app.include_router(oracle_router)
app.include_router(payments_router)
app.include_router(debug_router)
app.include_router(support_router)
app.include_router(quests_router)
app.include_router(games_router)


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "name": "Nexus API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
        "socket_namespaces": ["/chat", "/voice"]
    }


@app.get("/health")
async def health_check():
    """Detailed health check"""
    return {
        "status": "healthy",
        "database": "connected",
        "socketio": "enabled",
        "version": "1.0.0"
    }


@app.get("/favicon.ico")
async def favicon():
    """Serve favicon for browser tab"""
    from fastapi.responses import FileResponse
    favicon_path = os.path.join(static_dir, "favicon.png")
    if os.path.exists(favicon_path):
        return FileResponse(favicon_path, media_type="image/png")
    return {"error": "Favicon not found"}
