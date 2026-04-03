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

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
async def register(request: RegisterRequest):
    """
    Register a new user account.
    Username must be unique and cannot be changed after registration.
    """
    try:
        from app.services.email_service import generate_otp, send_otp_email
        from datetime import datetime, timedelta
        import random
        import string
        
        user_data = UserCreate(
            username=request.username,
            email=request.email,
            password=request.password
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
        if request.invite_code:
            referrer = await users_col.find_one({"invite_code": request.invite_code})
            if referrer:
                update_fields["referred_by"] = str(referrer["_id"])
                # Increment referrer's total_invites_successful
                await users_col.update_one(
                    {"_id": referrer["_id"]},
                    {"$inc": {"total_invites_successful": 1}}
                )
        
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
        await send_otp_email(request.email, otp, context="registration")
        
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
    last_login = user.get("login_streak_last_date")
    current_streak = user.get("login_streak_current", 0)
    
    if last_login:
        delta = (now.date() - last_login.date()).days
        if delta == 1:
            new_streak = current_streak + 1
        elif delta == 0:
            new_streak = current_streak
        else:
            new_streak = 1
    else:
        new_streak = 1
    
    await users_col.update_one(
        {"_id": user["_id"]},
        {"$set": {"login_streak_current": new_streak, "login_streak_last_date": now}}
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
