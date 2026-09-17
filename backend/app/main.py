"""
ContractLens — FastAPI Application Entrypoint
"""

import threading
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.actions.verifier import run_daily_verification
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.jobstores.redis import RedisJobStore

import urllib.parse

def get_scheduler() -> BackgroundScheduler:
    url = urllib.parse.urlparse(settings.redis_url)
    jobstores = {
        "default": RedisJobStore(
            jobs_key="ContractLens_jobs",
            run_times_key="ContractLens_running",
            host=url.hostname or "localhost",
            port=url.port or 6379,
            db=int(url.path[1:]) if url.path and len(url.path) > 1 else 0,
            password=url.password
        )
    }
    scheduler = BackgroundScheduler(jobstores=jobstores)
    return scheduler

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    from app.core.database import Base, engine
    Base.metadata.create_all(bind=engine)
    
    scheduler = get_scheduler()
    
    # Add jobs if they don't already exist in Redis
    from app.common.retention import run_retention_cleanup
    scheduler.add_job(run_retention_cleanup, "interval", hours=24, id="retention_job", replace_existing=True)
    
    scheduler.add_job(run_daily_verification, "interval", hours=24, id="verification_job", replace_existing=True)
    
    scheduler.start()
    yield
    # Shutdown
    scheduler.shutdown()

app = FastAPI(
    title="ContractLens API",
    description="AI Agent Pipeline for SaaS & Vendor Contract Risk Monitoring",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS — allow Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok", "service": "ContractLens API"}


from app.users.auth_router import router as auth_router
from app.contracts.router import router as contracts_router
from app.decisions.router import router as decisions_router
from app.actions.router import router as actions_router
from app.reports.dashboard import router as dashboard_router
from app.mcp_integration.router import router as mcp_router
from app.core.settings import router as settings_router
from app.reports.audit import router as audit_router
from app.reports.analytics import router as analytics_router
from app.integrations.notifications import router as notifications_router
from app.reports.renewals import router as renewals_router
from app.reports.export import router as export_router
from app.reports.vendors import router as vendors_router
from app.users.team_router import router as team_router
from app.integrations.webhooks_router import router as webhooks_router

app.include_router(auth_router, prefix="/auth", tags=["Auth"])
app.include_router(contracts_router, prefix="/contracts", tags=["Contracts"])
app.include_router(decisions_router, prefix="/decisions", tags=["Decisions"])
app.include_router(actions_router, prefix="/actions", tags=["Actions"])
app.include_router(dashboard_router, prefix="/dashboard", tags=["Dashboard"])
app.include_router(mcp_router, prefix="/mcp", tags=["MCP"])
app.include_router(settings_router, prefix="/settings", tags=["Settings"])
app.include_router(audit_router, prefix="/audit", tags=["Audit"])
app.include_router(analytics_router, prefix="/analytics", tags=["Analytics"])
app.include_router(notifications_router, prefix="/notifications", tags=["Notifications"])
app.include_router(renewals_router, prefix="/renewals", tags=["Renewals"])
app.include_router(export_router, prefix="/export", tags=["Export"])
app.include_router(vendors_router, prefix="/vendors", tags=["Vendors"])
app.include_router(team_router, prefix="/team", tags=["Team"])
app.include_router(webhooks_router, prefix="/webhooks", tags=["Webhooks"])


