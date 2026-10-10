"""
Authentication Routes
"""
from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import OAuth2PasswordRequestForm

from app.schemas.auth import (
    LoginRequest,
    TokenResponse,
    RegisterRequest,
    RegisterResponse,
)
from app.services.auth_service import AuthService
from app.middleware.auth import get_current_user
from app.models.user import UserCreate, UserRole
from app.database import get_users_collection

router = APIRouter(prefix="/auth", tags=["Authentication"])

from fastapi import Request
from fastapi.responses import JSONResponse
import time
from collections import defaultdict

# ---------------------------------------------------------------------------
# In-memory sliding-window rate limiter for /auth/register
#
# Limit: 5 requests per 10 minutes per source IP.
# NOTE: This is **per-worker** memory. With Gunicorn/uvicorn multi-worker
# deployments (e.g. Azure App Service) each worker has its own counter,
# meaning up to (N_WORKERS × 5) requests per window can slip through.
# For a single-worker ASGI deployment this is perfectly accurate.
# A distributed counter (e.g. Redis) would be needed for strict enforcement
# across all workers. This is documented here for operational awareness.
#
# Azure App Service proxy: The App Service sits behind an HTTP proxy that
# appends the original client IP to X-Forwarded-For. We prefer that header
# over request.client.host (which would be the proxy's IP). We take only
# the FIRST entry in X-Forwarded-For to avoid IP-spoofing via crafted headers
# (the proxy always appends after any client-supplied values).
# ---------------------------------------------------------------------------
_register_rate_limits: dict[str, list[float]] = defaultdict(list)
REGISTER_RATE_LIMIT_MAX = 5        # max requests per window
REGISTER_RATE_LIMIT_WINDOW_SEC = 600  # 10 minutes


def _get_client_ip(http_request: Request) -> str:
    """
    Extract the real client IP.
    Prefers the first value in X-Forwarded-For (set by Azure App Service /
    any reverse proxy) over direct socket address so the rate limiter counts
    against the real user, not the proxy.
    """
    forwarded_for = http_request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # X-Forwarded-For: <client>, <proxy1>, <proxy2>
        return forwarded_for.split(",")[0].strip()
    if http_request.client:
        return http_request.client.host
    return "unknown"


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
async def register(request_body: RegisterRequest, http_request: Request):
    """
    Register a new user account.
    Username must be unique and cannot be changed after registration.
    Rate limited to 5 requests per 10 minutes per source IP.
    """
    # --- Rate Limiting ---
    client_ip = _get_client_ip(http_request)
    now = time.time()

    # Purge timestamps outside the window
    _register_rate_limits[client_ip] = [
        ts for ts in _register_rate_limits[client_ip]
        if now - ts < REGISTER_RATE_LIMIT_WINDOW_SEC
    ]

    if len(_register_rate_limits[client_ip]) >= REGISTER_RATE_LIMIT_MAX:
        retry_after = int(
            REGISTER_RATE_LIMIT_WINDOW_SEC - (now - _register_rate_limits[client_ip][0])
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many registration attempts from this IP. Please try again later.",
            headers={"Retry-After": str(max(retry_after, 1))}
        )

    _register_rate_limits[client_ip].append(now)
    # ---------------------
    
    try:
        from app.services.email_service import generate_otp, send_otp_email
        from datetime import datetime, timedelta
        import random
        import string
        
        user_data = UserCreate(
            username=request_body.username,
            email=request_body.email,
            password=request_body.password
        )
        user = await AuthService.create_user(user_data)
        
        # Generate unique invite code (NEX-XXXX format)
        invite_code = "NEX-" + ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
        # Ensure uniqueness
        users_col = get_users_collection()
        while await users_col.find_one({"invite_code": invite_code}):
            invite_code = "NEX-" + ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
        
        update_fields = {
            "invite_code": invite_code,
        }
        
        # Handle referral tracking if invite_code was provided
        # TODO: Rate limiting MUST be implemented here to prevent script-driven mass registrations
        if request_body.invite_code:
            referrer = await users_col.find_one({"invite_code": request_body.invite_code})
            if referrer:
                update_fields["referred_by"] = str(referrer["_id"])
                update_fields["referral_credited"] = False
        
        # Generate and save email verification OTP
        otp = await generate_otp()
        expires_at = datetime.utcnow() + timedelta(minutes=10)
        
        update_fields.update({
            "email_verification_token": otp,
            "email_verification_expires": expires_at,
            "is_email_verified": False
        })
        
        await AuthService.update_user_profile(user["_id"], update_fields)
        
        # Send verification email
        try:
            await send_otp_email(request_body.email, otp, context="registration")
        except Exception as email_err:
            from bson import ObjectId
            # Rollback: delete the created user
            await users_col.delete_one({"_id": ObjectId(user["_id"])})
            import logging
            logging.error(f"Failed to send email to {request_body.email}: {str(email_err)}")
            raise ValueError("Failed to send verification email. Please try again.")
            
        return RegisterResponse(
            user_id=user["_id"],
            username=user["username"]
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/login", response_model=TokenResponse)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    OAuth2 compatible login endpoint.
    Returns JWT access token on successful authentication.
    """
    user, error_code = await AuthService.authenticate_user(form_data.username, form_data.password)
    
    if error_code == "USER_NOT_FOUND":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Email not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    elif error_code == "INVALID_PASSWORD":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check if banned
    if user.get("is_banned", False):
        ban_reason = user.get("ban_reason", "No reason provided")
        ban_expires = user.get("ban_expires_at")
        
        if ban_expires:
            detail = f"Account banned until {ban_expires.isoformat()}. Reason: {ban_reason}"
        else:
            detail = f"Account permanently banned. Reason: {ban_reason}"
        
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail
        )
    
    # Check if deleted
    if user.get("is_deleted", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account has been deleted"
        )
    
    # Check if email is verified (bypass for admin/super_admin roles)
    user_role = user.get("role", "user")
    if user_role not in ("admin", "super_admin", "system") and not user.get("is_email_verified", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified. Please verify your email first."
        )
    
    # Create token
    token = AuthService.create_user_token(user)
    
    # --- Login streak tracking ---
    from datetime import datetime, timedelta
    from app.database import get_users_collection
    users_col = get_users_collection()
    now = datetime.utcnow()
    today_start = datetime(now.year, now.month, now.day)
    yesterday_start = today_start - timedelta(days=1)
    
    # 1. Try to increment streak if last login was yesterday
    result = await users_col.update_one(
        {
            "_id": user["_id"],
            "login_streak_last_date": {"$gte": yesterday_start, "$lt": today_start}
        },
        {
            "$inc": {"login_streak_current": 1},
            "$set": {"login_streak_last_date": now}
        }
    )
    
    # 2. If it wasn't yesterday, it's either today (no change needed) or earlier (reset to 1)
    if result.modified_count == 0:
        await users_col.update_one(
            {
                "_id": user["_id"],
                "$or": [
                    {"login_streak_last_date": {"$lt": yesterday_start}},
                    {"login_streak_last_date": {"$exists": False}},
                    {"login_streak_last_date": None}
                ]
            },
            {
                "$set": {
                    "login_streak_current": 1,
                    "login_streak_last_date": now
                }
            }
        )
    
    # --- Backfill invite code for existing users ---
    if not user.get("invite_code"):
        import random
        import string
        invite_code = "NEX-" + ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
        while await users_col.find_one({"invite_code": invite_code}):
            invite_code = "NEX-" + ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
        await users_col.update_one(
            {"_id": user["_id"]},
            {"$set": {"invite_code": invite_code}}
        )
    
    return TokenResponse(
        access_token=token,
        user_id=str(user["_id"]),
        username=user["username"],
        role=user.get("role", UserRole.USER.value)
    )


@router.get("/me")
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """
    Get current authenticated user information.
    """
    # Remove sensitive fields
    safe_user = {
        "_id": current_user["_id"],
        "username": current_user["username"],
        "display_name": current_user.get("display_name"),
        "email": current_user["email"],
        "role": current_user["role"],
        "is_premium": current_user.get("is_premium", False),
        "premium_since": current_user.get("premium_since"),
        "premium_expires_at": current_user.get("premium_expires_at"),
        "avatar_url": current_user.get("avatar_url"),
        "avatar_type": current_user.get("avatar_type"),
        "banner_url": current_user.get("banner_url"),
        "banner_type": current_user.get("banner_type"),
        "bio": current_user.get("bio"),
        "accent_color": current_user.get("accent_color"),
        "theme_color": current_user.get("theme_color"),
        "status": current_user.get("status", "online"),
        "created_at": current_user.get("created_at"),
        # Economy
        "aether_shards": current_user.get("aether_shards", 0),
        "available_server_boosts": current_user.get("available_server_boosts", 0),
        "owned_relics": current_user.get("owned_relics", []),
        "equipped_relics": current_user.get("equipped_relics", {}),
        # Invite Code
        "invite_code": current_user.get("invite_code"),
        # Quest Stats
        "total_messages_sent": current_user.get("total_messages_sent", 0),
        "total_invites_successful": current_user.get("total_invites_successful", 0),
        "has_uploaded_avatar": current_user.get("has_uploaded_avatar", False),
        "total_reactions_given": current_user.get("total_reactions_given", 0),
        "total_servers_joined": current_user.get("total_servers_joined", 0),
        # Email verification
        "is_email_verified": current_user.get("is_email_verified", current_user.get("role", "user") in ("admin", "super_admin", "system")),
    }
    
    # Badges — admins/super_admins auto-own all standard badges
    owned_badges = list(current_user.get("owned_badges", []))
    if current_user.get("role") in ("admin", "super_admin"):
        for badge_id in ("founder", "scholar", "arena_champion"):
            if badge_id not in owned_badges:
                owned_badges.append(badge_id)
    
    safe_user["owned_badges"] = owned_badges
    safe_user["equipped_badges"] = current_user.get("equipped_badges", [])
    safe_user["is_founder"] = current_user.get("is_founder", False)
    safe_user["games_won"] = current_user.get("games_won", 0)
    safe_user["completed_quests_count"] = current_user.get("completed_quests_count", 0)
    
    return safe_user


# Password Reset and Email Verification Schemas
from pydantic import BaseModel, EmailStr

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp: str
    new_password: str

class VerifyEmailRequest(BaseModel):
    email: EmailStr
    otp: str


@router.post("/verify-email")
async def verify_email(request: VerifyEmailRequest):
    """
    Verify user email using OTP.
    """
    from datetime import datetime
    
    user = await AuthService.get_user_by_email(request.email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email or OTP"
        )
        
    stored_token = user.get("email_verification_token")
    expires_at = user.get("email_verification_expires")
    
    if not stored_token or request.otp != stored_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email or OTP"
        )
        
    if not expires_at or datetime.utcnow() > expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This verification code has expired. Please register again or request a new one."
        )
        
    # Mark as verified and cleanup
    await AuthService.update_user_profile(user["_id"], {
        "is_email_verified": True,
        "email_verification_token": None,
        "email_verification_expires": None
    })
    
    # Process referral credit securely
    if user.get("referred_by") and not user.get("referral_credited"):
        from app.database import get_users_collection
        from bson import ObjectId
        users_col = get_users_collection()
        
        # Atomically check and mark as credited
        result = await users_col.update_one(
            {"_id": ObjectId(user["_id"]), "referral_credited": {"$ne": True}},
            {"$set": {"referral_credited": True}}
        )
        if result.modified_count > 0:
            await users_col.update_one(
                {"_id": ObjectId(user["referred_by"])},
                {"$inc": {"total_invites_successful": 1}}
            )
    
    return {"message": "Email verified successfully. You can now log in."}


@router.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    """
    Request a password reset OTP to be sent to email.
    """
    from app.services.email_service import send_otp_email, generate_otp
    from datetime import datetime, timedelta
    
    # Check if user exists
    user = await AuthService.get_user_by_email(request.email)
    
    # Always return success message to prevent email enumeration
    if not user:
        return {"message": "If an account with that email exists, we've sent a password reset code."}
    
    # Generate OTP and expiration
    otp = await generate_otp()
    expires_at = datetime.utcnow() + timedelta(minutes=10)
    
    # Update user with token
    await AuthService.update_user_profile(user["_id"], {
        "reset_password_token": otp,
        "reset_password_expires": expires_at
    })
    
    # Send OTP
    success = await send_otp_email(request.email, otp)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send reset email. Please try again."
        )
    
    return {"message": "If an account with that email exists, we've sent a password reset code."}


@router.post("/reset-password")
async def reset_password(request: ResetPasswordRequest):
    """
    Reset password using OTP verification.
    """
    from datetime import datetime
    
    # Validate password length
    if len(request.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters"
        )
    
    # Check if user exists
    user = await AuthService.get_user_by_email(request.email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email or OTP"
        )
    
    # Verify OTP
    stored_token = user.get("reset_password_token")
    expires_at = user.get("reset_password_expires")
    
    if not stored_token or request.otp != stored_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email or OTP"
        )
        
    if not expires_at or datetime.utcnow() > expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This reset code has expired. Please request a new one."
        )
    
    # Update password
    success = await AuthService.update_password(request.email, request.new_password)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update password"
        )
        
    # Cleanup tokens
    await AuthService.update_user_profile(user["_id"], {
        "reset_password_token": None,
        "reset_password_expires": None
    })
    
    return {"message": "Password reset successfully. You can now log in."}
