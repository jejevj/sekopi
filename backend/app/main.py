from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.scheduler import scheduler, start_scheduler, stop_scheduler
from app.core.tasks import (
    task_mark_expired_units,
    task_expiry_warning_log,
    task_low_stock_alert,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # === STARTUP ===
    # Daftarkan semua cron jobs
    scheduler.add_job(
        task_mark_expired_units,
        trigger="cron",
        hour=0,
        minute=1,
        id="mark_expired_units",
        replace_existing=True,
    )
    scheduler.add_job(
        task_expiry_warning_log,
        trigger="cron",
        hour=7,
        minute=0,
        id="expiry_warning_log",
        replace_existing=True,
    )
    scheduler.add_job(
        task_low_stock_alert,
        trigger="cron",
        hour=7,
        minute=0,
        id="low_stock_alert",
        replace_existing=True,
    )
    start_scheduler()
    yield
    # === SHUTDOWN ===
    stop_scheduler()


app = FastAPI(
    title="SekoPi API",
    description="Sistem Manajemen Kopi Gerobakan",
    version="1.0.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/")
async def root():
    return {"message": "SekoPi API is running", "docs": "/docs"}
