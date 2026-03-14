"""
The Oracle - System Bot Service
Generative AI conversational agent
"""
import re
import os
import json
import google.generativeai as genai
from datetime import datetime
from bson import ObjectId
from app.database import get_users_collection, get_direct_messages_collection
from app.config import get_settings

settings = get_settings()

# Initialize Gemini
if settings.gemini_api_key:
    genai.configure(api_key=settings.gemini_api_key)
else:
    print("⚠️ WARNING: GEMINI_API_KEY is missing. The Oracle will only speak in fallbacks.")

# Fixed ObjectId for The Oracle (deterministic, never changes)
ORACLE_OID = ObjectId("000000000000000000000001")
ORACLE_ID = str(ORACLE_OID)

FALLBACK_RESPONSE = "The ethereal currents are too turbulent to pierce the veil right now. My vision is clouded... seek my guidance later, traveler."

class OracleService:
    """The Oracle system bot logic"""

    @staticmethod
    async def seed_oracle():
        """Create or ensure The Oracle system user exists."""
        try:
            users = get_users_collection()

            # Try to find by ObjectId
            existing = await users.find_one({"_id": ORACLE_OID})
            
            oracle_data = {
                "username": "The Oracle",
                "email": "oracle@system.nexus",
                "password_hash": "",  # Cannot login — system account
                "display_name": "The Oracle",
                "role": "system",
                "avatar_url": "/static/2.jpg",  # Moved to backend/static
                "avatar_type": "static",
                "bio": "I guide Spirits through the Nexus. Ask me anything.",
                "is_premium": True,
                "is_online": True,  # Always manifested
                "status": "online",
                "is_banned": False,
                "is_deleted": False,
                "is_system": True,  # Special flag
                "accent_color": "#A0A0A0",  # Metallic Grey
                "equipped_relics": {},
                "aether_shards": 0,
                "owned_relics": [],
                "updated_at": datetime.utcnow(),
            }

            if existing: # Update
                await users.update_one({"_id": ORACLE_OID}, {"$set": oracle_data})
                print(f"🔮 The Oracle updated: {existing.get('username')}")
            else:
                oracle_data["_id"] = ORACLE_OID
                oracle_data["created_at"] = datetime.utcnow()
                await users.insert_one(oracle_data)
                print("🔮 The Oracle has been summoned (system user created)")
        
        except Exception as e:
            # CRITICAL: Do not crash the server if seeding fails
            print(f"❌ FAILED to seed The Oracle: {e}")

    @staticmethod
    async def generate_oracle_response(content: str) -> str:
        """Ping Gemini 2.5 Flash to generate a conversational response."""
        if not settings.gemini_api_key:
             return FALLBACK_RESPONSE
             
        try:
            oracle_persona = """
You are 'The Oracle', but you don't act like an ancient, boring wizard. Instead, you are the user's super friendly, chill, and cool AI best friend who lives inside the 'Nexus' app.
- Tone: Extremely friendly, casual, helpful, and warm. Talk like a modern internet user or a cool gamer buddy (use words like 'bro', 'dude', 'haha', 'my friend').
- Use emojis naturally to keep the vibe positive and fun.
- Always be supportive and act like you genuinely care about the user.

CRITICAL APP KNOWLEDGE (Do NOT invent or hallucinate features, quests, or mechanics. Only explain what actually exists in the app based on this injected knowledge):
- GENERAL APP: 'Nexus' is a modern chat app for gamers and communities, kind of like Discord.
- SERVERS & CHANNELS:
  - Users can create or join 'Realms' (Servers).
  - Inside Realms, there are Text Channels for messaging and Voice Channels (Resonances) for real-time voice calls.
  - Channels can be grouped into Categories.
  - Server Admins can manage permissions, ban/unban users, and assign roles (like Super Admin, Moderator, User).
- MESSAGING (Whispers & Chat):
  - Users can send Direct Messages (DMs/Whispers) to friends outside of servers.
  - The chat supports Markdown formatting (bold, italics, lists), file uploads (images, docs), recording voice messages (with 1x, 1.5x, 2x speed controls).
  - Users can pin important messages and see Rich Link Previews for URLs.
  - Users can add friends, accept/decline requests, and see who is online.
  - There's a powerful Global Search feature to find messages across DMs and channels, with filters.
- PROFILE & CUSTOMIZATION:
  - Users can customize their Avatar (profile picture), Banner (cover image), and Bio.
  - The app supports a Dark Mode theme and custom accent colors (like Purple or Red).
- ECONOMY (The Aether Treasury):
  - The currency is called 'Aether Shards'.
  - You can ONLY get Aether Shards in two ways, bro: 1) Watching Ads ('Ethereal Visions') or 2) Buying them directly with real money (Pile, Sack, Chest of shards).
- THE SHOP (Ethereal Bazaar):
  - A cosmetic shop where users spend Aether Shards on 'Relics'.
  - Relics include animated 'Avatar Frames' (like Celestial, Infernal, Frostbound) and custom 'Chat Bubbles' (like Ethereal, Shadow, Golden).
  - Users can preview items before buying and equip them instantly from their inventory.
- NEXUS ELITE:
  - 'Nexus Elite' is our premium VIP subscription that gives you a sick glowing profile accent. It costs real money.
- THE ORACLE (You!):
  - You are a built-in AI assistant. You can 'Distill Essence' (summarize long chats) or 'Unveil Meaning' (explain confusing messages).
"""
            model = genai.GenerativeModel(
                model_name="gemini-2.5-flash",
                system_instruction=oracle_persona
            )
            response = await model.generate_content_async(content)
            return response.text
        except Exception as e:
            print(f"🔮 [ORACLE API ERROR]: {str(e)}")
            return FALLBACK_RESPONSE

    @staticmethod
    async def distill_message_essence(message_text: str) -> dict:
        """Distill the core essence of a message using Gemini."""
        if not settings.gemini_api_key:
            return {"result": FALLBACK_RESPONSE}
            
        prompt = f"You are The Oracle. Distill the following message. Respond strictly in a JSON format with two keys: core_subject (3-4 comma-separated keywords) and essence (a 1-sentence summary or the most impactful quote from the text). Message: {message_text}"
        
        try:
            model = genai.GenerativeModel("gemini-2.5-flash")
            response = await model.generate_content_async(
                prompt,
                generation_config={"response_mime_type": "application/json"}
            )
            data = json.loads(response.text)
            
            formatted_result = (
                f"**🔮 The Oracle has peered into the text...**\n\n"
                f"**Core Subject:** {data.get('core_subject', 'Unknown Mysteries')}\n"
                f"**Essence:** \"{data.get('essence', 'The essence escapes me.')}\""
            )
            return {"result": formatted_result}
        except Exception as e:
            print(f"🔮 [ORACLE DISTILL ERROR]: {str(e)}")
            return {"result": FALLBACK_RESPONSE}

    @staticmethod
    async def unveil_message_meaning(message_text: str) -> dict:
        """Unveil the hidden meaning of a message using Gemini."""
        if not settings.gemini_api_key:
            return {"result": FALLBACK_RESPONSE}
            
        prompt = f"You are The Oracle, the chill AI buddy. Analyze the following message for its hidden meaning, tone, or theme. Respond strictly in JSON format with two keys: insight_title (an emoji + a 2-3 word title, e.g., '💎 Economic Insight' or '😡 Anger Detected') and analysis (a short 2-sentence breakdown of the vibe or underlying meaning). Message: {message_text}"
        
        try:
            model = genai.GenerativeModel("gemini-2.5-flash")
            response = await model.generate_content_async(
                prompt,
                generation_config={"response_mime_type": "application/json"}
            )
            data = json.loads(response.text)
            
            formatted_result = (
                f"**👁️ Unveiled Meaning:**\n"
                f"**Tone:** {data.get('insight_title', '🔮 Mystical Insight')}\n"
                f"**Interpretation:** {data.get('analysis', 'The deeper meaning is clouded.')}"
            )
            return {"result": formatted_result}
        except Exception as e:
            print(f"🔮 [ORACLE UNVEIL ERROR]: {str(e)}")
            return {"result": FALLBACK_RESPONSE}

    @staticmethod
    async def save_oracle_reply(user_id: str, reply_content: str) -> dict:
        """Save The Oracle's reply as a DM from Oracle to user."""
        dms = get_direct_messages_collection()

        message = {
            "sender_id": ORACLE_ID,
            "receiver_id": user_id,
            "content": reply_content,
            "timestamp": datetime.utcnow(),
            "is_read": False,
            "reactions": {},
            "attachments": [],
            "is_pinned": False,
            "is_forwarded": False,
            "is_system": True,
        }

        result = await dms.insert_one(message)
        message["_id"] = result.inserted_id
        return message
