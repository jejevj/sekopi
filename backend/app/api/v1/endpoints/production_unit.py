from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_roles
from app.models.user import User, UserRole
from app.repositories.production_unit_repo import ProductionUnitRepository
from app.schemas.production_unit import (
    ExpiryAlertResponse,
    GenerateUnitsRequest,
    PaginatedUnitResponse,
    ProductionUnitResponse,
    ScanDeliverRequest,
    ScanDispatchRequest,
    ScanResultResponse,
    ScanSellRequest,
    ScanVoidRequest,
)
from app.services.production_unit_service import ProductionUnitService, _enrich_unit

router = APIRouter()


@router.post("/generate", response_model=list[ProductionUnitResponse], status_code=status.HTTP_201_CREATED)
async def generate_units(
    payload: GenerateUnitsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.PRODUKSI)),
):
    """Generate barcode units dari MO DONE. Input expiry_date & harga_modal (opsional)."""
    service = ProductionUnitService(db)
    try:
        return await service.generate_units(
            payload.mo_id, payload.jumlah, payload.expiry_date,
            payload.harga_modal, current_user.id
        )
    except (ValueError, Exception) as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/expiry-alerts", response_model=ExpiryAlertResponse)
async def expiry_alerts(
    days: int = Query(default=2, ge=1, le=30),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(
        UserRole.ADMIN, UserRole.PRODUKSI, UserRole.INVENTORI, UserRole.SHAREHOLDER
    )),
):
    service = ProductionUnitService(db)
    return await service.get_expiry_alerts(days)


@router.post("/trigger-mark-expired")
async def trigger_mark_expired(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    service = ProductionUnitService(db)
    return await service.trigger_mark_expired()


@router.get("/mo/{mo_id}", response_model=PaginatedUnitResponse)
async def get_units_by_mo(
    mo_id: int,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(
        UserRole.ADMIN, UserRole.PRODUKSI, UserRole.INVENTORI
    )),
):
    """List unit per MO dengan pagination. Diurutkan FEFO."""
    service = ProductionUnitService(db)
    return await service.get_by_mo_paginated(mo_id, page, per_page)


@router.get("/ready-fefo", response_model=PaginatedUnitResponse)
async def get_ready_fefo(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(
        UserRole.ADMIN, UserRole.PRODUKSI, UserRole.DRIVER
    )),
):
    """List semua unit READY diurutkan FEFO — panduan dispatch driver."""
    service = ProductionUnitService(db)
    return await service.get_ready_fefo_paginated(page, per_page)


@router.get("/barcode/{barcode}", response_model=ProductionUnitResponse)
async def get_unit_by_barcode(
    barcode: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(
        UserRole.ADMIN, UserRole.PRODUKSI, UserRole.DRIVER, UserRole.INVENTORI
    )),
):
    repo = ProductionUnitRepository(db)
    unit = await repo.get_by_barcode(barcode)
    if not unit:
        raise HTTPException(status_code=404, detail="Barcode tidak ditemukan")
    return _enrich_unit(unit)


@router.post("/scan/dispatch", response_model=list[ScanResultResponse])
async def scan_dispatch(
    payload: ScanDispatchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DRIVER)),
):
    service = ProductionUnitService(db)
    return await service.scan_dispatch(payload, current_user.id)


@router.post("/scan/deliver", response_model=list[ScanResultResponse])
async def scan_deliver(
    payload: ScanDeliverRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DRIVER)),
):
    service = ProductionUnitService(db)
    return await service.scan_deliver(payload, current_user.id)


@router.post("/scan/sell", response_model=ScanResultResponse)
async def scan_sell(
    payload: ScanSellRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DRIVER)),
):
    """Driver scan jual di gerobak. Driver = kasir gerobak."""
    service = ProductionUnitService(db)
    return await service.scan_sell(payload, current_user.id)


@router.post("/scan/void", response_model=ScanResultResponse)
async def scan_void(
    payload: ScanVoidRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.PRODUKSI, UserRole.DRIVER)),
):
    """Void manual unit. Admin, Produksi, atau Driver bisa void."""
    service = ProductionUnitService(db)
    return await service.scan_void(payload, current_user.id)
