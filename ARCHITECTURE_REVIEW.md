# ARCHITECTURE_REVIEW.md — Nexus Platform

> **Audience:** Senior Software Engineers / Technical Due Diligence  
> **Revision:** April 2026  
> **Codebase Snapshot:** 151 source files · ~38,277 LOC · 1.52 MB pure source

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Tech Stack & Libraries](#2-tech-stack--libraries)
3. [Real-Time Communication Layer (The Sockets)](#3-real-time-communication-layer-the-sockets)
4. [WebRTC & Voice Implementation](#4-webrtc--voice-implementation)
5. [Database Schema Design (MongoDB)](#5-database-schema-design-mongodb)
6. [AI & Automation Logic (Nexus Sentinel & Oracle)](#6-ai--automation-logic-nexus-sentinel--oracle)
7. [State Management (Frontend)](#7-state-management-frontend)
8. [Authentication & Authorization Pipeline](#8-authentication--authorization-pipeline)
9. [Known Technical Debt & Recommendations](#9-known-technical-debt--recommendations)

---

## 1. System Architecture Overview

### 1.1 High-Level Topology

Nexus is a **decoupled, dual-deployment** architecture with a clear separation between a Python async backend and a React single-page application frontend.

```
┌──────────────────────────────────────────────────────────────────┐
│                        CLIENT TIER                               │
│                                                                  │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐  │
│  │  React SPA   │   │  Electron    │   │  Mobile Browser      │  │
│  │  (Vercel)    │   │  Desktop App │   │  (Responsive)        │  │
│  └──────┬───────┘   └──────┬───────┘   └──────────┬───────────┘  │
│         │                  │                      │              │
│         └──────────────────┼──────────────────────┘              │
│                            │                                     │
│              ┌─────────────┴─────────────┐                       │
│              │     Axios HTTP Client     │                       │
│              │  Socket.IO-Client (WS)     │                       │
│              │  simple-peer (WebRTC)      │                       │
│              └─────────────┬─────────────┘                       │
└────────────────────────────┼─────────────────────────────────────┘
                             │
                    ─────────┼──────────
                    Internet / WSS / HTTPS
                    ─────────┼──────────
                             │
┌────────────────────────────┼─────────────────────────────────────┐
│                        SERVER TIER (Azure)                        │
│                                                                  │
│  ┌─────────────────────────┴─────────────────────────────────┐   │
│  │                    Gunicorn (ASGI)                         │   │
│  │          ┌──────────────────────────────────┐             │   │
│  │          │         FastAPI App               │             │   │
│  │          │                                  │             │   │
│  │          │  ┌────────────┐  ┌────────────┐  │             │   │
│  │          │  │ 18 REST    │  │ Socket.IO  │  │             │   │
│  │          │  │ Routers    │  │ ASGI Mount  │  │             │   │
│  │          │  └────────────┘  └─────┬──────┘  │             │   │
│  │          │                        │         │             │   │
│  │          │              ┌─────────┴───────┐ │             │   │
│  │          │              │  /chat    /voice │ │             │   │
│  │          │              │  Namespaces      │ │             │   │
│  │          │              └─────────────────┘ │             │   │
│  │          └──────────────────────────────────┘             │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │  MongoDB      │  │  Cloudinary  │  │  Google Gemini 2.5     │  │
│  │  (Atlas)      │  │  CDN         │  │  Flash API             │  │
│  │  12 collections│  │  File Store  │  │  (AI Engine)           │  │
│  └──────────────┘  └──────────────┘  └────────────────────────┘  │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐                              │
│  │  PayPal API  │  │  Gmail SMTP  │                              │
│  │  (Payments)  │  │  (Email)     │                              │
│  └──────────────┘  └──────────────┘                              │
└──────────────────────────────────────────────────────────────────┘
```

### 1.2 Deployment Infrastructure

| Component | Host | Notes |
|---|---|---|
| **Frontend SPA** | Vercel | Zero-config React deployment. Production URL: `try-nexus.vercel.app` |
| **Backend API** | Azure App Service | Gunicorn with Uvicorn workers. ASGI-mode for async + WebSocket support |
| **Database** | MongoDB Atlas | Managed cluster. Async access via Motor driver |
| **File Storage** | Cloudinary | CDN-backed media uploads (avatars, banners, attachments) |
| **Desktop Client** | Electron 28 | Wraps the React SPA. Custom `electron/main.js` with preload script |

### 1.3 Process Lifecycle

The backend uses FastAPI's `lifespan` context manager (not the deprecated `@app.on_event`) to manage startup/shutdown:

```python
# backend/app/main.py — Lines 20-43
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await Database.connect()           # Motor async client init
    await seed_super_admin_on_startup() # Idempotent admin seeding
    await OracleService.seed_oracle()   # System bot seeding
    yield
    # Shutdown
    await Database.disconnect()
```

The `Database.connect()` call is deferred to lifespan to avoid the **AsyncIOMotorClient event loop deadlock** that occurs when instantiated at module-import time under Gunicorn. This was a specific production bug fix (the client must bind to the running event loop, not the import-time loop).

### 1.4 ASGI Mount Strategy

Socket.IO is not run as a separate process. Instead, it's mounted directly onto the FastAPI ASGI application:

```python
# backend/app/main.py — Lines 104-112
from app.socket_instance import sio   # Shared AsyncServer instance

sio.register_namespace(ChatNamespace("/chat"))
sio.register_namespace(VoiceNamespace("/voice"))

socket_app = socketio.ASGIApp(sio, socketio_path="socket.io")
app.mount("/socket.io", socket_app)
```

The `sio` instance is defined in a **separate module** (`socket_instance.py`) specifically to avoid circular imports — routers need to emit socket events (e.g., broadcasting message updates), and socket handlers need to call service layer functions. The shared instance pattern breaks this cycle.

```python
# backend/app/socket_instance.py — complete file
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=[
        "http://localhost:3000",
        "http://localhost:5000",
        "https://try-nexus.vercel.app",
    ],
    logger=False,
    engineio_logger=False
)
```

---

## 2. Tech Stack & Libraries

### 2.1 Backend (Python 3.10+)

| Library | Version | Purpose |
|---|---|---|
| `fastapi` | 0.109.0 | ASGI web framework. Async request handling, dependency injection, OpenAPI auto-docs |
| `uvicorn` | 0.27.0 | ASGI server (used as Gunicorn worker class in production) |
| `gunicorn` | 21.2.0 | Production process manager for multi-worker deployment |
| `motor` | 3.3.2 | Async MongoDB driver (wraps PyMongo for asyncio) |
| `pymongo` | 4.6.1 | Underlying synchronous MongoDB driver (Motor dependency) |
| `python-socketio` | 5.11.0 | Async Socket.IO server. Dual namespace architecture |
| `pydantic` | 2.5.3 | Data validation via schemas. Uses `BeforeValidator` for ObjectId handling |
| `pydantic-settings` | 2.1.0 | Environment variable management with `.env` loading |
| `python-jose[cryptography]` | 3.3.0 | JWT creation/verification (HS256) |
| `passlib[bcrypt]` | 1.7.4 | Password hashing (bcrypt backend) |
| `google-generativeai` | 0.8.5 | Google Gemini 2.5 Flash SDK for AI features |
| `cloudinary` | 1.38.0 | Cloud media upload service |
| `Pillow` | 10.2.0 | Image processing (avatar/banner manipulation) |
| `httpx` | 0.27.0 | Async HTTP client (used for PayPal server-side API calls) |
| `aiofiles` | 23.2.1 | Async file I/O for local file operations |
| `python-multipart` | 0.0.6 | Multipart form parsing (required by FastAPI for file uploads) |

### 2.2 Frontend (React 18)

| Library | Version | Purpose |
|---|---|---|
| `react` | 18.2.0 | UI rendering library |
| `react-dom` | 18.2.0 | DOM rendering target |
| `react-router-dom` | 6.21.0 | Client-side routing with protected/public route guards |
| `zustand` | 4.4.7 | Lightweight state management (8 stores, no Redux boilerplate) |
| `socket.io-client` | 4.7.2 | Socket.IO client for real-time messaging |
| `simple-peer` | 9.11.1 | WebRTC P2P wrapper (abstracts RTCPeerConnection signaling) |
| `axios` | 1.13.4 | HTTP client with interceptors for JWT injection |
| `i18next` | 25.8.13 | Internationalization framework (8 language json files) |
| `react-i18next` | 16.5.4 | React bindings for i18next |
| `react-markdown` | 10.1.0 | Markdown rendering in chat messages |
| `emoji-picker-react` | 4.18.0 | Emoji picker for message reactions |
| `lucide-react` | 0.563.0 | Icon library (tree-shakeable SVG icons) |
| `react-hot-toast` | 2.6.0 | Toast notifications |
| `@paypal/react-paypal-js` | 9.0.0 | PayPal checkout button integration |
| `webpack` | 5.89.0 | Module bundler (custom config, no CRA) |
| `electron` | 28.1.0 | Desktop app shell (dev dependency) |

### 2.3 Internationalization Coverage

Eight language files under `frontend/src/locales/`:

| Language | File | Size |
|---|---|---|
| English (base) | `en.json` | 21 KB |
| Arabic (MSA) | `ar.json` | 27 KB |
| Spanish | `es.json` | 23 KB |
| French | `fr.json` | 24 KB |
| Japanese | `ja.json` | 26 KB |
| Portuguese | `pt.json` | 23 KB |
| Russian | `ru.json` | 32 KB |
| Chinese (Simplified) | `zh.json` | 21 KB |

Language detection is automatic via `i18next-browser-languagedetector`.

---

## 3. Real-Time Communication Layer (The Sockets)

### 3.1 Namespace Architecture

The Socket.IO server operates with **two isolated namespaces**, each implemented as a `socketio.AsyncNamespace` subclass:

| Namespace | Class | File | Purpose |
|---|---|---|---|
| `/chat` | `ChatNamespace` | `sockets/chat.py` | Text messaging, typing indicators, presence, DM call signaling |
| `/voice` | `VoiceNamespace` | `sockets/voice.py` | WebRTC signaling for voice channels and DM voice calls |

The client connects to each namespace independently:

```javascript
// frontend/src/services/socket.js — Lines 45-51
chatSocket = io(`${SOCKET_URL}/chat`, {
    auth,                              // { user_id, username, token }
    transports: ['websocket'],         // Skip long-polling, go straight to WS
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5
});
```

### 3.2 Room Partitioning Strategy

Rooms are string-keyed and follow a strict naming convention:

| Room Pattern | Scope | Populated By |
|---|---|---|
| `user_{user_id}` | Personal room (per-user) | `on_connect` — auto-joined on authentication |
| `channel_{channel_id}` | Text channel room | `on_join_channel` — joined when user selects a channel |
| `voice_{channel_id}` | Voice channel room (WebRTC signaling module) | `on_join_voice` |
| `dm_call_{min(id1,id2)}_{max(id1,id2)}` | Isolated DM voice call room | `on_join_dm_call` — deterministic ID ensures both users join the same room |

The personal room (`user_{user_id}`) is critical — it enables the server to push events to a specific user regardless of what channel they're viewing:

```python
# Example: Game challenge notification pushed to opponent's personal room
# backend/app/routers/games.py — Lines 133-138
await sio.emit(
    "game:challenge_received",
    serialized,
    room=f"user_{opponent_id}",
    namespace="/chat",
)
```

### 3.3 Connection Lifecycle & Presence Tracking

Presence is tracked via a **module-level dictionary** in `chat.py`:

```python
# backend/app/sockets/chat.py — Line 14
online_users = {}   # {user_id: set(sids)}
```

Each `user_id` maps to a **set of socket IDs (SIDs)** to handle multi-device connections. The database `is_online` flag only flips on the **first connection** and **last disconnection**:

```python
# on_connect (simplified) — Lines 62-75
if user_id not in online_users:
    online_users[user_id] = set()
    # First connection — mark online in DB
    await users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"is_online": True}}
    )
    # Broadcast presence to ALL connected clients
    await self.emit("presence_update", {"user_id": user_id, "status": "online"})

online_users[user_id].add(sid)
```

```python
# on_disconnect (simplified) — Lines 104-116
online_users[user_id].discard(sid)
if not online_users[user_id]:
    # Last session gone — mark offline
    del online_users[user_id]
    await users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"is_online": False, "last_seen": datetime.utcnow()}}
    )
    await self.emit("presence_update", {"user_id": user_id, "status": "offline"})
```

**Key design decision:** Presence broadcasts are emitted to the **entire namespace** (no `room=` filter), meaning every connected client receives every online/offline event. This is simple but scales linearly with connected-user count. For >10K concurrent users, this would need to be refactored to per-server or per-friends-list scoping.

### 3.4 Typing Indicators

Typing indicators use a **per-namespace in-memory dictionary** and the `skip_sid` parameter to avoid echoing back to the sender:

```python
# backend/app/sockets/chat.py — Lines 251-277
# Channel typing
self.typing_users[channel_id][user["user_id"]] = datetime.utcnow()

await self.emit("user_typing", {
    "channel_id": channel_id,
    "user_id": user["user_id"],
    "username": user["username"]
}, room=room, skip_sid=sid)
```

DM typing uses a separate event pair (`dm_typing_start`/`dm_typing_stop`) that targets the receiver's personal room:

```python
# Lines 311-317
await self.emit("dm_user_typing", {
    "sender_id": user["user_id"],
    "sender_username": user["username"],
    "receiver_id": receiver_id
}, room=f"user_{receiver_id}")
```

On the frontend, the `typingStore` (Zustand) maintains dual typing maps:

```javascript
// frontend/src/store/typingStore.js
channelTyping: {},   // { channelId: [{ user_id, username }] }
dmTyping: {},        // { friendId: { username, timestamp } }
```

### 3.5 Message Broadcasting (Dual Path)

Messages can be sent through **two paths** — both land in the same Socket.IO room:

1. **Socket.IO direct** (`on_send_message` in `chat.py`): Used for real-time channel chat. The socket handler saves to DB and broadcasts.
2. **REST API + Socket emit** (`POST /messages/{channel_id}` in `messages.py`): Used for HTTP-based sends (file uploads, multipart forms). The router saves to DB, then calls `sio.emit()` on the shared instance.

Both paths broadcast `new_message` to `channel_{channel_id}`.

---

## 4. WebRTC & Voice Implementation

### 4.1 Signaling Flow (Server Voice Channels)

The voice implementation follows the **classic simple-peer signaling pattern** over Socket.IO:

```
User A joins voice channel
    → emit("join_voice", {room_id, user_id, username})
    ← receive("all_users", [existing_users])

For each existing user:
    User A creates initiator Peer (simple-peer, initiator: true)
    → emit("sending_signal", {userToSignal: existing_sid, signal, callerID: A_sid})
    
    Existing User receives "user_joined" event
    Existing User creates responder Peer (initiator: false)
    Existing User signals back
    → emit("returning_signal", {callerID: A_sid, signal})

    User A receives "receiving_returned_signal"
    → peer.signal(signal)  // Connection established
```

```python
# backend/app/sockets/voice.py — Lines 82-108
async def on_sending_signal(self, sid, payload):
    user_to_signal = payload.get("userToSignal")
    await self.emit("user_joined", {
        "signal": payload.get("signal"),
        "callerID": payload.get("callerID"),
        "username": self.users.get(sid, {}).get("username"),
        "user_id": self.users.get(sid, {}).get("user_id"),
        "is_muted": self.users.get(sid, {}).get("is_muted", False)
    }, to=user_to_signal)

async def on_returning_signal(self, sid, payload):
    caller_id = payload.get("callerID")
    await self.emit("receiving_returned_signal", {
        "signal": payload.get("signal"),
        "id": sid
    }, to=caller_id)
```

### 4.2 Codec Configuration

The Opus codec is configured at 96kbps stereo, 48kHz sample rate — returned to the client on voice join:

```python
# backend/app/sockets/webrtc_signaling.py — Lines 124-130
return {
    "success": True,
    "channel_id": channel_id,
    "participants": participants,
    "codec_config": {
        "codec": "opus",
        "bitrate": 96000,
        "channels": 2,         # Stereo
        "sample_rate": 48000   # 48kHz
    }
}
```

### 4.3 Zombie Session Cleanup

A recurring issue with WebRTC over Socket.IO is ghost/zombie sessions — a user's previous SID lingers after reconnection. The voice namespace handles this explicitly:

```python
# backend/app/sockets/voice.py — Lines 40-51
# Check if this user_id is already in the room with a different SID
sids_to_remove = []
for existing_sid, info in self.users.items():
    if info["user_id"] == user_id and existing_sid != sid:
        print(f"👻 Removing ghost session for {username} ({existing_sid})")
        sids_to_remove.append(existing_sid)

for ghost_sid in sids_to_remove:
    await self._handle_leave(ghost_sid)
```

### 4.4 DM Voice Calls (Isolated Rooms)

DM calls use a **deterministic room ID** to ensure both participants always join the exact same room, regardless of who initiates:

```python
# backend/app/sockets/voice.py — Lines 171-173
def _get_dm_room_id(self, id1: str, id2: str) -> str:
    return f"dm_call_{min(id1, id2)}_{max(id1, id2)}"
```

The DM call flow has a **separate signaling event set** (`sending_dm_signal`, `returning_dm_signal`, `dm_user_joined`, `dm_user_left`, `dm_user_muted`) to prevent cross-contamination between server voice channels and 1-on-1 calls.

The **call initiation/ringing flow** happens on the `/chat` namespace (not `/voice`):

```
Caller → emit("initiate_dm_call", {receiver_id})
    Server → emit("incoming_dm_call", {...caller_info...}, room=f"user_{receiver_id}")

Receiver sees IncomingCallModal
    Accept → emit("accept_dm_call", {caller_id})
             Server → emit("dm_call_accepted", room=f"user_{caller_id}")
             Both users then connect to /voice and emit join_dm_call

    Decline → emit("decline_dm_call", {caller_id})
              Server → emit("dm_call_declined", room=f"user_{caller_id}")
```

### 4.5 Mute/Deafen Sync

Mute state is tracked server-side in the `self.users` dictionary and broadcast to the room on toggle:

```python
# backend/app/sockets/voice.py — Lines 110-133
user_info["is_muted"] = is_muted
await self.emit("user_muted", {
    "sid": sid,
    "user_id": user_info["user_id"],
    "is_muted": is_muted
}, room=room_id, skip_sid=sid)
```

Deafen automatically forces mute:

```python
if user["is_deafened"]:
    user["is_muted"] = True
```

---

## 5. Database Schema Design (MongoDB)

### 5.1 Collections Overview

12 collections with indexed fields:

| Collection | Document Shape | Key Indexes |
|---|---|---|
| `users` | User profile, auth, economy, presence | `email` (unique), `username` (unique) |
| `servers` | Server config, sentinel settings | `invite_code` (unique) |
| `members` | Server ↔ User join table | `(server_id, user_id)` compound unique |
| `channels` | Text/voice channel definitions | `(server_id, type)` compound |
| `messages` | Channel messages + attachments | `channel_id`, TTL 30d auto-expire |
| `direct_messages` | DM messages + attachments | `(sender_id, receiver_id)`, TTL 30d |
| `friends` | Friend relationships + status | `(requester_id, receiver_id)` unique |
| `starred_messages` | Bookmarked messages (per-user) | `(user_id, message_id)` unique |
| `tickets` | Support tickets | `user_id`, `status` |
| `ticket_messages` | Ticket thread messages | `ticket_id` |
| `user_quest_progress` | Quest completion + claim tracking | `(user_id, quest_id)` unique |
| `game_challenges` | Game invitations between friends | `(opponent_id, status)`, `(challenger_id, status)`, TTL 5min |
| `audit_logs` | Sentinel moderation audit trail | *(no explicit index beyond _id)* |

### 5.2 Users Collection — Deep Schema

The `users` collection is the most complex document. Fields are organized by concern:

```javascript
{
  _id: ObjectId,
  
  // IDENTITY & AUTH
  username: String,                    // Unique, 3-32 chars
  email: String,                       // Unique, validated via Pydantic EmailStr
  password_hash: String,               // bcrypt hash
  display_name: String,                // Defaults to username
  role: "user" | "admin" | "super_admin" | "system",
  is_email_verified: Boolean,
  email_verification_token: String,    // OTP for email verify
  email_verification_expires: DateTime,
  reset_password_token: String,        // OTP for password reset
  reset_password_expires: DateTime,
  
  // PROFILE & COSMETICS
  avatar_url: String,                  // Cloudinary URL
  avatar_type: "static" | "animated", // Premium distinction
  banner_url: String,
  banner_type: "solid" | "gradient" | "animated",
  bio: String,                         // Max 500 chars
  accent_color: String,                // Hex, e.g. "#7c3aed"
  theme_color: String,                 // Client-side theme
  about_me: String,                    // Max 300 chars
  
  // PREMIUM SYSTEM
  is_premium: Boolean,
  premium_plan: "monthly" | "yearly" | null,
  premium_since: DateTime,
  premium_expires_at: DateTime,        // Lazy-evaluated on auth middleware
  
  // VIRTUAL ECONOMY
  aether_shards: Number,              // Virtual currency balance
  available_server_boosts: Number,     // Purchasable boost inventory
  owned_relics: [String],             // Array of relic IDs (e.g. "frame_celestial")
  equipped_relics: {                   // Slot-based equip system
    frame: "relic_id",                 // One avatar frame at a time
    bubble: "relic_id"                 // One chat bubble at a time
  },
  
  // GAMIFICATION & BADGES
  total_messages_sent: Number,         // Incremented atomically via $inc
  total_invites_successful: Number,
  has_uploaded_avatar: Boolean,
  total_reactions_given: Number,
  total_servers_joined: Number,
  games_won: Number,
  completed_quests_count: Number,
  owned_badges: [String],             // Unlocked badge IDs
  equipped_badges: [String],          // Displayed badges (max 4)
  is_founder: Boolean,                // Special designation
  
  // REFERRAL SYSTEM
  invite_code: String,                // User's personal invite code
  referred_by: String,                // user_id of referrer
  
  // MODERATION
  is_banned: Boolean,
  ban_reason: String,
  ban_expires_at: DateTime,           // null = permanent
  is_deleted: Boolean,                // Soft delete flag
  
  // PRESENCE
  status: "online" | "dnd" | "idle" | "invisible",
  is_online: Boolean,                 // Set by Socket.IO connect/disconnect
  last_seen: DateTime,                // Set on disconnect
  
  // METADATA
  created_by: String,                 // user_id (if created by admin)
  created_at: DateTime,
  updated_at: DateTime
}
```

**Key mutation patterns:**

- `aether_shards`: Modified atomically via `$inc` (quest claims, purchases) or set directly (shop buys). No transaction isolation — last-write-wins.
- `total_messages_sent`: Incremented in a non-blocking try/catch after every message send. Failure does not block the message.
- `is_premium` / `premium_expires_at`: **Lazy-evaluated** in the auth middleware — if `premium_expires_at < now`, the middleware auto-revokes premium on the next API call. No background job required.

### 5.3 Servers Collection

```javascript
{
  _id: ObjectId,
  name: String,
  icon_url: String,
  banner_url: String,
  boost_level: Number,               // Incremented when users apply server boosts
  owner_id: String,                  // user_id
  invite_code: String,               // Unique, auto-generated
  
  // SENTINEL (per-server moderation config)
  sentinel_settings: {
    is_enabled: Boolean,
    anti_spam: Boolean,               // Rate-limit detection
    anti_links: Boolean,              // URL regex filter
    banned_words: [String],           // Custom word blacklist
    ai_strictness: Boolean            // Reserved for Gemini content analysis
  },
  
  // MODERATION
  is_banned: Boolean,
  ban_reason: String,
  ban_expires_at: DateTime,
  is_deleted: Boolean,
  
  created_at: DateTime,
  updated_at: DateTime
}
```

### 5.4 Members Collection (Join Table)

```javascript
{
  _id: ObjectId,
  server_id: String,
  user_id: String,
  role: "owner" | "moderator" | "member",
  
  // Server-level mute
  is_muted: Boolean,
  mute_reason: String,
  mute_expires_at: DateTime,
  
  // Sentinel enforcement
  strikes: Number,                    // Accumulated violations
  timeout_until: DateTime,            // Chat restriction expiry
  
  joined_at: DateTime
}
```

### 5.5 TTL (Time-To-Live) Indexes

Messages and DMs auto-expire after 30 days via MongoDB TTL indexes:

```python
# backend/app/database.py — Lines 54-65
await cls.db.messages.create_index(
    "timestamp",
    expireAfterSeconds=2592000  # 30 days
)

await cls.db.direct_messages.create_index(
    "timestamp",
    expireAfterSeconds=2592000
)
```

Game challenges expire after 5 minutes:

```python
await cls.db.game_challenges.create_index(
    "expires_at",
    expireAfterSeconds=300
)
```

---

## 6. AI & Automation Logic (Nexus Sentinel & Oracle)

### 6.1 Nexus Sentinel — Message Interception Pipeline

The Sentinel is **not a separate microservice or background worker**. It is an inline interception layer embedded directly in the `POST /messages/{channel_id}` route handler. The check runs **synchronously** (in async terms) before the message is persisted to MongoDB.

**Execution order in `messages.py` (lines 78–242):**

```
1. Validate channel exists + user is member         ← Standard auth
2. Check mute status                                  ← Server-level mute
3. Check timeout_until (Sentinel-imposed)             ← Previous violation timeout
4. ─── SENTINEL INTERCEPTION BLOCK ───
   a. Load server.sentinel_settings
   b. Skip if: Sentinel disabled OR user role is owner/moderator
   c. Anti-Links check (regex: https?://)
   d. Banned Words check (case-insensitive substring match)
   e. Anti-Spam check (count messages in last 5 seconds >= 5)
   f. If violation detected:
      - Increment member.strikes atomically
      - If strikes >= 2: set timeout_until = now + 10 minutes
      - Write audit_log entry
      - Emit socket event to violator's personal room:
        - Strike 1: "sentinel_warning"
        - Strike 2+: "sentinel_timeout"
      - RAISE HTTPException 400 → Message is NOT saved
5. ─── END SENTINEL BLOCK ───
6. Process file attachment (Cloudinary upload)
7. Save message to DB via MessageService
8. Broadcast via Socket.IO
9. Increment total_messages_sent (quest stat)
```

**Critical detail:** The Sentinel check runs **before** `MessageService.create_message()`. If the content is flagged, the HTTP response is a 400 error, and no document is ever inserted. The message is rejected at the gateway.

```python
# backend/app/routers/messages.py — Lines 152-242 (condensed)
if server and server.get("sentinel_settings", {}).get("is_enabled") \
   and member["role"] not in ["owner", "moderator"]:
    sentinel = server["sentinel_settings"]
    is_violation = False
    violation_reason = ""
    
    # 1. Anti-Links
    if sentinel.get("anti_links") and content:
        if re.search(r"https?://", content, re.IGNORECASE):
            is_violation = True
            violation_reason = "Posting links is not allowed"

    # 2. Banned Words (case-insensitive substring match)
    if not is_violation and content and sentinel.get("banned_words"):
        content_lower = content.lower()
        for word in sentinel.get("banned_words"):
            if word.strip() and word.strip().lower() in content_lower:
                is_violation = True
                violation_reason = f"Usage of banned word: {word}"
                break
    
    # 3. Anti-Spam (sliding window: 5 messages in 5 seconds)
    if not is_violation and sentinel.get("anti_spam"):
        five_sec_ago = datetime.utcnow() - timedelta(seconds=5)
        recent_msgs = await messages_col.count_documents({
            "channel_id": channel_id,
            "user_id": current_user["_id"],
            "timestamp": {"$gt": five_sec_ago}
        })
        if recent_msgs >= 5:
            is_violation = True
            violation_reason = "Triggered anti-spam limit"

    if is_violation:
        # Increment strikes + optional timeout
        new_strikes = member.get("strikes", 0) + 1
        if new_strikes >= 2:
            timeout_until = datetime.utcnow() + timedelta(minutes=10)
        
        # Audit log
        await audit_col.insert_one({
            "server_id": channel["server_id"],
            "action": "sentinel_auto_mod",
            "user_id": current_user["_id"],
            "reason": violation_reason,
            "created_at": datetime.utcnow()
        })
        
        # Real-time notification to violator
        if new_strikes == 1:
            await sio.emit("sentinel_warning", {...}, room=str(user_id), namespace="/chat")
        elif new_strikes >= 2:
            await sio.emit("sentinel_timeout", {...}, room=str(user_id), namespace="/chat")

        raise HTTPException(400, detail=f"Sentinel Blocked: {violation_reason}")
```

**Limitation:** The `ai_strictness` flag exists in the `SentinelSettings` model but has no runtime implementation yet. It's reserved for a future Gemini-powered content analysis check.

### 6.2 The Oracle — AI System Bot

The Oracle is a **system-level user account** with a fixed, deterministic ObjectId:

```python
# backend/app/services/oracle_service.py — Lines 23-24
ORACLE_OID = ObjectId("000000000000000000000001")
ORACLE_ID = str(ORACLE_OID)
```

It is seeded on every application startup (idempotent upsert) and has special flags:

```python
oracle_data = {
    "username": "The Oracle",
    "email": "oracle@system.nexus",
    "password_hash": "",           # Cannot authenticate — system account
    "role": "system",              # Not user/admin/super_admin
    "is_system": True,             # Special flag
    "is_online": True,             # Always appears online
    "status": "online",
}
```

**Three API capabilities:**

1. **Conversational Chat** (`POST /oracle/summarize` with user's message): Uses Gemini 2.5 Flash with a detailed system prompt. The Oracle responds as a friendly AI buddy with full app knowledge injected into the persona.

2. **Distill Essence** (chat summarization): Sends the message to Gemini with a prompt to extract `core_subject` (keywords) and `essence` (1-sentence summary). Response is forced to `application/json` MIME type via `generation_config`.

3. **Unveil Meaning** (sentiment analysis): Sends the message to Gemini for tone/theme analysis. Returns `insight_title` (emoji + title) and `analysis` (2-sentence breakdown).

**Multi-language critical constraint:** The Oracle's system prompt includes strict instructions to respond in the same language as the input:

```python
# Line 89
"CRITICAL LANGUAGE RULE: You MUST respond in the EXACT same language 
that the user used in their message."
```

**Fallback behavior:** If `GEMINI_API_KEY` is missing or the API call fails, a hardcoded mystic fallback string is returned — the app never crashes due to AI unavailability.

---

## 7. State Management (Frontend)

### 7.1 Architecture: Zustand Store Network

The frontend uses **8 Zustand stores** — each is a standalone `create()` call that produces a hook. There is no global store composition; stores are independent atoms with intentional cross-store references where needed.

| Store | File | Lines | Concerns |
|---|---|---|---|
| `useAuthStore` | `authStore.js` | 139 | JWT lifecycle, login/register/logout, localStorage persistence |
| `useServerStore` | `serverStore.js` | 400 | Server/channel/member CRUD, message list, pinned messages |
| `useFriendsStore` | `friendsStore.js` | 465 | Friends list, DM messages, unread counts, socket listeners, game challenges |
| `useVoiceStore` | `voiceStore.js` | 48 | DM call state (incoming call, accepted, declined), mute/deafen flags |
| `useShopStore` | `shopStore.js` | 87 | Relic catalog, buy/equip/unequip, shard balance |
| `useQuestStore` | `questStore.js` | 58 | Quest list, claim logic, cross-store shard sync |
| `useTypingStore` | `typingStore.js` | 83 | Channel typing maps, DM typing maps |
| `useUIStore` | `uiStore.js` | 45 | Layout flags (friends panel, shop, Prime screen, mobile view, theme) |

### 7.2 Key Patterns

**Pattern 1: Optimistic Updates**

The `serverStore` pins/unpins messages optimistically — the UI updates immediately, and the API call happens in the background:

```javascript
// frontend/src/store/serverStore.js — Lines 184-193
pinMessage: async (messageId) => {
    try {
        await messagesAPI.pinMessage(messageId);
        // Optimistically update local state
        get().updateMessage(messageId, { is_pinned: true });
        return { success: true };
    } catch (error) {
        return { success: false, error: error.response?.data?.detail };
    }
},
```

The same pattern is used for member mute/unmute/kick — the member list updates instantly in the UI without waiting for the API round-trip.

**Pattern 2: Cross-Store Synchronization**

When a quest is claimed and shards are earned, the `questStore` updates both the `authStore` AND `shopStore` to ensure the shard balance is consistent everywhere:

```javascript
// frontend/src/store/questStore.js — Lines 36-48
// Sync new shard balance to BOTH stores so UI updates instantly
try {
    const { useAuthStore } = await import('./authStore');
    useAuthStore.getState().updateUser({ aether_shards: new_balance });
} catch (e) { /* graceful fallback */ }
try {
    const { useShopStore } = await import('./shopStore');
    useShopStore.setState({ shards: new_balance });
} catch (e) { /* graceful fallback */ }
```

Similarly, when equipping a relic in the shop, the `shopStore` writes back to `authStore` so the profile panel and chat bubbles reflect the change:

```javascript
// frontend/src/store/shopStore.js — Line 51
useAuthStore.getState().updateUser({ equipped_relics: response.data.equipped_relics });
```

**Pattern 3: Socket Event Binding**

The `friendsStore` acts as the **DM socket event dispatcher**. It registers listeners on the chat socket and routes events to the appropriate state mutations:

```javascript
// frontend/src/store/friendsStore.js — Lines 339-451
setupSocketListeners: (socket) => {
    // 1. DM message handler (with deduplication, focus detection, unread counting)
    socket.on('dm_new_message', (newMessage) => { ... });
    
    // 2. Friend request listener (real-time badge update)
    socket.on('friend_request_received', (data) => { ... });
    
    // 3. Game challenge listeners
    socket.on('game:challenge_received', (challenge) => { ... });
    socket.on('game:challenge_accepted', (challenge) => { ... });
    socket.on('game:challenge_declined', (challenge) => { ... });
}
```

**Pattern 4: Message Deduplication**

Both `serverStore.addMessage()` and `friendsStore.addDMMessage()` perform ID-based deduplication to prevent the same message from appearing twice (race condition between HTTP response and socket broadcast):

```javascript
// frontend/src/store/friendsStore.js — Lines 204-216
addDMMessage: (message) => {
    set(state => {
        const exists = state.dmMessages.some(m => m._id === message._id);
        if (exists) return {};  // No-op
        return { dmMessages: [...state.dmMessages, message] };
    });
},
```

**Pattern 5: Auth Persistence**

The `authStore` hydrates from `localStorage` on creation (not on mount):

```javascript
// frontend/src/store/authStore.js — Lines 6-17
const getInitialState = () => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    return {
        token: token || null,
        user: user ? JSON.parse(user) : null,
        isAuthenticated: !!token,
    };
};

export const useAuthStore = create((set, get) => ({
    ...getInitialState(),
    // ...
}));
```

This means the auth state survives full page refreshes without any wrapper component or `useEffect` hydration step.

**Pattern 6: Mutual Exclusion of Views**

When selecting a server, the `serverStore.selectServer()` method closes any open DM conversation and resets UI overlay flags:

```javascript
// frontend/src/store/serverStore.js — Lines 31-48
selectServer: async (serverId) => {
    // Close any open DM
    try {
        const friendsStore = getFriendsStore();
        friendsStore.getState().closeDM();
    } catch (e) {}

    // Reset UI overlays
    try {
        const { useUIStore } = require('./uiStore');
        useUIStore.getState().setShowPrimeScreen(false);
        useUIStore.getState().setShowFriendsPanel(false);
        useUIStore.getState().setShowGamingHub(false);
    } catch (e) {}
    // ...
}
```

This enforces a clean state machine: the user is either viewing a server, a DM, the friends panel, the shop, or the Prime screen — never multiple simultaneously.

---

## 8. Authentication & Authorization Pipeline

### 8.1 JWT Flow

```
Client                            Server
  │                                  │
  ├── POST /auth/login ──────────────┤
  │   (email + password via          │
  │    x-www-form-urlencoded)        │
  │                                  ├── Verify password (bcrypt)
  │                                  ├── Create JWT { sub: user_id, role, username }
  │   ◄── { access_token } ─────────┤     (HS256, 24hr expiry)
  │                                  │
  ├── GET /auth/me ──────────────────┤   (Bearer token in Authorization header)
  │   ◄── { user profile } ──────────┤
  │                                  │
  │   [All subsequent requests       │
  │    include Bearer token via      │
  │    Axios request interceptor]    │
```

### 8.2 Auth Middleware (`get_current_user`)

The `get_current_user` dependency does more than token validation — it performs **lazy side effects**:

1. **Token decode** → extract `user_id` from `sub` claim
2. **DB lookup** → fetch full user document
3. **Soft delete check** → 403 if `is_deleted`
4. **Ban check** → 403 if `is_banned`. But if `ban_expires_at < now`, **auto-unban** the user inline
5. **Premium expiry check** → if `premium_expires_at < now`, **auto-revoke** premium inline (no background job needed)
6. **ObjectId serialization** → convert `_id` from ObjectId to string

```python
# backend/app/middleware/auth.py — Lines 76-90
if user.get("is_premium", False):
    premium_expires = user.get("premium_expires_at")
    if premium_expires and premium_expires < datetime.utcnow():
        await users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {
                "is_premium": False,
                "premium_expires_at": None,
                "premium_plan": None,
            }}
        )
        user["is_premium"] = False
```

### 8.3 RBAC Middleware

Role-based access is implemented via a **callable class** pattern:

```python
# backend/app/middleware/rbac.py
class RoleChecker:
    def __init__(self, allowed_roles: List[UserRole]):
        self.allowed_roles = allowed_roles
    
    async def __call__(self, current_user = Depends(get_current_user)):
        if user_role not in [role.value for role in self.allowed_roles]:
            raise HTTPException(403, detail="Access denied")
        return current_user
```

Pre-configured permission functions are used as FastAPI dependencies:

```python
# Usage in admin routes:
@router.post("/create-admin")
async def create_admin(current_user = Depends(can_manage_admins)):  # Super Admin only
    ...

@router.get("/users")
async def list_users(current_user = Depends(can_manage_users)):     # Admin + Super Admin
    ...
```

Three role tiers exist at the **application level**: `user`, `admin`, `super_admin`.  
Three role tiers exist at the **server level**: `member`, `moderator`, `owner`.

These are independent — a platform `admin` can manage users globally but has no special role within a specific server unless they're also that server's `owner` or `moderator`.

---

## 9. Known Technical Debt & Recommendations

### 9.1 Scalability Concerns

| Area | Issue | Recommendation |
|---|---|---|
| **Presence broadcasts** | `presence_update` emitted to entire namespace (O(n) connected users) | Scope to friends-list or server-membership rooms |
| **Voice state** | `self.users` dict is in-memory on a single process | Move to Redis pub/sub for horizontal scaling |
| **online_users dict** | Module-level global in `chat.py` — lost on worker restart | Persist to Redis with TTL |
| **Sentinel anti-spam** | Queries MongoDB on every message send for rate counting | Use a Redis sliding window counter |

### 9.2 Code Quality

| Area | Issue | Recommendation |
|---|---|---|
| **Mega-components** | `ChatArea.js` (98KB), `DirectMessageArea.js` (92KB) | Decompose into sub-components (MessageList, InputBar, ToolbarActions) |
| **No TypeScript** | Entire frontend is vanilla JS | Introduce TypeScript gradually (strict mode, starting with stores + API layer) |
| **No test suite** | Zero unit or integration tests | Add pytest for backend services, Jest for Zustand stores |
| **Hardcoded catalogs** | Quest + Relic catalogs are Python constants, not DB-driven | Migrate to a `relics` collection for admin-editable catalog |

### 9.3 Security Items

| Area | Issue | Severity |
|---|---|---|
| **Default credentials** | `config.py` has hardcoded super_admin email/password as defaults | **High** — Override via `.env` in production. Remove defaults |
| **Socket auth** | Socket.IO auth uses `user_id` from client `auth` payload — no JWT verification on socket connect | **Medium** — Validate JWT on socket connect |
| **ObjectId injection** | Some routes accept raw ObjectId strings without explicit validation | **Low** — Pydantic `BeforeValidator` handles most cases |

### 9.4 Missing Infrastructure

| Area | Status |
|---|---|
| CI/CD pipeline | Not present (no GitHub Actions, no Dockerfile) |
| Rate limiting (API-level) | Not implemented (only Sentinel does per-channel rate limiting) |
| Request logging / APM | Not present (only console.log prints) |
| Database migrations | Not applicable (schemaless MongoDB), but no version tracking on schema changes |
| WebSocket authentication | Auth payload is client-provided, not server-verified with JWT |