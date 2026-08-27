import sys, importlib, pkgutil
import app
import app.main
import app.core.config
import app.core.database
import app.models
import app.services.ai_service
import app.services.clustering
import app.services.pipeline
import app.services.scheduler
import app.services.telegram_bot
import app.api.router
import app.api.routes.feed
import app.api.routes.admin
import app.api.routes.sources
import app.api.routes.social
import app.api.routes.auth
print("ALL BACKEND MODULES IMPORTED PERFECTLY!")
