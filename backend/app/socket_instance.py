"""
Shared Socket.IO Instance
Avoids circular imports between main.py, socket handlers, and routers.
"""
import socketio

# Create Socket.IO server
# async_mode='asgi' is essential for integration with FastAPI
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
