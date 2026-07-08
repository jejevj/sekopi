from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

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

# Ambil origins dari settings; kalau ["*"] gunakan wildcard langsung
_origins = settings.BACKEND_CORS_ORIGINS
if _origins == ["*"] or _origins == "*":
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# FIX: tolak request body > 20MB dengan pesan yang jelas
MAX_BODY_SIZE = 20 * 1024 * 1024  # 20 MB


@app.middleware("http")
async def limit_body_size(request: Request, call_next):
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_BODY_SIZE:
        return JSONResponse(
            status_code=413,
            content={"detail": "Ukuran request terlalu besar (maks 20MB)."},
        )
    return await call_next(request)


app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/")
async def root():
    return {"message": "SekoPi API is running", "docs": "/docs"}
