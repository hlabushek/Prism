from fastapi import APIRouter
from app.api.routes import auth, feed, sources, social, admin

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(feed.router)
api_router.include_router(sources.router)
api_router.include_router(social.router)
api_router.include_router(admin.router)
