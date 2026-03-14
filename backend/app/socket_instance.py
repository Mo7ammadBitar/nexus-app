"""
Shared Socket.IO Instance
Avoids circular imports between main.py, socket handlers, and routers.
"""
import socketio

# Create Socket.IO server
# async_mode='asgi' is essential for integration with FastAPI
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",  # Configure properly in production
    logger=False,
    engineio_logger=False
)
