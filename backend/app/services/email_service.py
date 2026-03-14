"""
Email Service - Handles sending OTP emails for password reset
"""
import smtplib
import random
import string
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
from app.config import get_settings
from app.database import Database

settings = get_settings()


async def generate_otp() -> str:
    """Generate a 6-digit OTP"""
    return ''.join(random.choices(string.digits, k=6))


async def store_otp(email: str, otp: str) -> bool:
    """Store OTP in database with expiration"""
    db = Database.db
    otp_collection = db.password_reset_otps
    
    # Remove any existing OTP for this email
    await otp_collection.delete_many({"email": email.lower()})
    
    # Store new OTP with 15-minute expiration
    await otp_collection.insert_one({
        "email": email.lower(),
        "otp": otp,
        "created_at": datetime.utcnow(),
        "expires_at": datetime.utcnow() + timedelta(minutes=15)
    })
    
    return True


async def verify_otp(email: str, otp: str) -> bool:
    """Verify OTP is valid and not expired"""
    db = Database.db
    otp_collection = db.password_reset_otps
    
    record = await otp_collection.find_one({
        "email": email.lower(),
        "otp": otp,
        "expires_at": {"$gt": datetime.utcnow()}
    })
    
    if record:
        # Delete the OTP after successful verification
        await otp_collection.delete_one({"_id": record["_id"]})
        return True
    
    return False


async def send_otp_email(email: str, otp: str, context: str = "password_reset") -> bool:
    """Send OTP email using SMTP"""
    try:
        # Determine content based on context
        if context == "registration":
            subject = "Nexus - Verify Your Email"
            title = "Verify Email"
            body_text = "Welcome to Nexus! Use the code below to verify your email address and complete registration:"
        else:
            subject = "Nexus - Password Reset Code"
            title = "Password Reset"
            body_text = "We received a request to reset your password. Use the code below to complete the process:"
            
        # Create message
        message = MIMEMultipart("alternative")
        message["Subject"] = subject
        message["From"] = settings.mail_from
        message["To"] = email
        
        # HTML email body
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; background-color: #1a1a2e; color: #ffffff; padding: 20px; margin: 0; }}
                .container {{ max-width: 500px; margin: 0 auto; background-color: #16213e; border-radius: 16px; padding: 40px; }}
                .logo {{ text-align: center; margin-bottom: 30px; }}
                .logo-text {{ font-size: 42px; font-weight: bold; background: linear-gradient(135deg, #580c85, #a855f7); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; letter-spacing: 2px; }}
                h1 {{ color: #ffffff; text-align: center; margin-bottom: 10px; }}
                p {{ color: #b4b4b4; text-align: center; line-height: 1.6; }}
                .otp-box {{ background-color: #0f3460; padding: 20px; border-radius: 12px; text-align: center; margin: 30px 0; }}
                .otp-code {{ font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #a855f7; }}
                .footer {{ text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="logo">
                    <span class="logo-text">NEXUS</span>
                </div>
                <h1>{title}</h1>
                <p>{body_text}</p>
                <div class="otp-box">
                    <div class="otp-code">{otp}</div>
                </div>
                <p>This code will expire in <strong>15 minutes</strong>.</p>
                <p>If you didn't request this, you can safely ignore this email.</p>
                <div class="footer">
                    <p>© 2024 Nexus. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Plain text fallback
        text = f"""
        Nexus - {title}
        
        {body_text}
        Your code is: {otp}
        
        This code will expire in 15 minutes.
        
        If you didn't request this, please ignore this email.
        """
        
        part1 = MIMEText(text, "plain")
        part2 = MIMEText(html, "html")
        message.attach(part1)
        message.attach(part2)
        
        # Send email using SMTP
        with smtplib.SMTP(settings.mail_server, settings.mail_port) as server:
            server.starttls()
            server.login(settings.mail_username, settings.mail_password)
            server.sendmail(settings.mail_from, email, message.as_string())
        
        return True
        
    except Exception as e:
        print(f"Failed to send email: {e}")
        return False


async def send_password_reset_otp(email: str) -> dict:
    """Generate, store and send OTP for password reset"""
    otp = await generate_otp()
    await store_otp(email, otp)
    
    success = await send_otp_email(email, otp)
    
    return {
        "success": success,
        "message": "OTP sent successfully" if success else "Failed to send OTP"
    }
