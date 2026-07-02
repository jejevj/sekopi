from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_roles
from app.models.user import User, UserRole
from app.repositories.production_unit_repo import ProductionUnitRepository
from app.schemas.production_unit import (
    GenerateUnitsRequest,
    ProductionUnitResponse,
    ScanDeliverRequest,
    ScanDispatchRequest,
    ScanResultResponse,
    ScanSellRequest,
    ScanVoidRequest,
)
from app.services.production_unit_service import ProductionUnitService

router = APIRouter()


@router.post("/generate", response_model=list[ProductionUnitResponse], status_code=status.HTTP_201_CREATED)
async def generate_units(
    payload: GenerateUnitsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.PRODUKSI)),
):
    """Generate barcode units dari MO yang sudah DONE."""
    service = ProductionUnitService(db)
    try:
        return await service.generate_units(payload.mo_id, payload.jumlah, current_user.id)
    except (ValueError, Exception) as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/mo/{mo_id}", response_model=list[ProductionUnitResponse])
async def get_units_by_mo(
    mo_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.PRODUKSI, UserRole.INVENTORI)),
):
    repo = ProductionUnitRepository(db)
    return await repo.get_by_mo(mo_id)


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
    return unit


@router.post("/scan/dispatch", response_model=list[ScanResultResponse])
async def scan_dispatch(
    payload: ScanDispatchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DRIVER)),
):
    """Driver scan barcode saat loading ke kendaraan."""
    service = ProductionUnitService(db)
    return await service.scan_dispatch(payload, current_user.id)


@router.post("/scan/deliver", response_model=list[ScanResultResponse])
async def scan_deliver(
    payload: ScanDeliverRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.DRIVER)),
):
    """Driver/Gerobak scan konfirmasi terima."""
    service = ProductionUnitService(db)
    return await service.scan_deliver(payload, current_user.id)


@router.post("/scan/sell", response_model=ScanResultResponse)
async def scan_sell(
    payload: ScanSellRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.PRODUKSI)),
):
    """Kasir scan barcode saat penjualan."""
    service = ProductionUnitService(db)
    return await service.scan_sell(payload, current_user.id)


@router.post("/scan/void", response_model=ScanResultResponse)
async def scan_void(
    payload: ScanVoidRequest,
    db: AsyncStorage = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.PRODUKSI)),
):
    """Void unit yang rusak atau salah."""
    service = ProductionUnitService(db)
    return await service.scan_void(payload, current_user.id)
