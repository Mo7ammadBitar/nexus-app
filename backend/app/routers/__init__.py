"""
Routers Package
"""
from app.routers.auth import router as auth_router
from app.routers.users import router as users_router
from app.routers.servers import router as servers_router
from app.routers.messages import router as messages_router
from app.routers.friends import router as friends_router
from app.routers.dm import router as dm_router
from app.routers.shop import router as shop_router
from app.routers.debug import router as debug_router
from app.routers.oracle import router as oracle_router
from app.routers.payments import router as payments_router
from app.routers.economy import router as economy_router
from app.routers.admin import router as admin_router
from app.routers.starred import router as starred_router
from app.routers.preview import router as preview_router
from app.routers.search import router as search_router
from app.routers.support import router as support_router
from app.routers.quests import router as quests_router
from app.routers.games import router as games_router
