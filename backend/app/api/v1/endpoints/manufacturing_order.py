from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_roles
from app.models.user import User, UserRole
from app.repositories.mo_repo import MORepository
from app.schemas.manufacturing_order import (
    ManufacturingOrderCreate,
    ManufacturingOrderResponse,
    ManufacturingOrderUpdate,
    ManufacturingOrderUpdateStatus,
)
from app.services.mo_service import MOService

router = APIRouter()

# Semua role yang boleh melihat MO
VIEW_ROLES = (UserRole.ADMIN, UserRole.PRODUKSI, UserRole.INVENTORI, UserRole.SHAREHOLDER)

# Role yang boleh membuat MO baru (request)
CREATE_ROLES = (UserRole.ADMIN, UserRole.PRODUKSI)

# Role yang boleh update status (gabungan semua yang terlibat dalam alur)
STATUS_ROLES = (UserRole.ADMIN, UserRole.PRODUKSI, UserRole.INVENTORI)


@router.get("/", response_model=list[ManufacturingOrderResponse])
async def list_mo(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*VIEW_ROLES)),
):
    repo = MORepository(db)
    return await repo.get_all()


@router.post("/", response_model=ManufacturingOrderResponse, status_code=status.HTTP_201_CREATED)
async def create_mo(
    payload: ManufacturingOrderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*CREATE_ROLES)),
):
    """PRODUKSI / ADMIN buat request MO baru. Status awal: DRAFT."""
    service = MOService(db)
    return await service.create_mo(payload, current_user.id)


@router.get("/{mo_id}", response_model=ManufacturingOrderResponse)
async def get_mo(
    mo_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*VIEW_ROLES)),
):
    repo = MORepository(db)
    mo = await repo.get_with_lines(mo_id)
    if not mo:
        raise HTTPException(status_code=404, detail="Manufacturing Order tidak ditemukan")
    return mo


@router.patch("/{mo_id}", response_model=ManufacturingOrderResponse)
async def update_mo(
    mo_id: int,
    payload: ManufacturingOrderUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*CREATE_ROLES)),
):
    """Edit detail MO — hanya saat status DRAFT."""
    service = MOService(db)
    try:
        return await service.update_mo(mo_id, payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{mo_id}/status", response_model=ManufacturingOrderResponse)
async def update_status(
    mo_id: int,
    payload: ManufacturingOrderUpdateStatus,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*STATUS_ROLES)),
):
    """
    Update status MO dengan role-based transition:
    - DRAFT → CONFIRMED   : hanya ADMIN (persetujuan)
    - CONFIRMED → IN_PROGRESS : hanya INVENTORI / ADMIN (keluarkan bahan)
    - IN_PROGRESS → DONE  : hanya PRODUKSI / ADMIN (selesai produksi)
    - * → CANCELLED       : ADMIN (atau PRODUKSI untuk draft sendiri)
    """
    service = MOService(db)
    try:
        return await service.update_status(mo_id, payload, current_user.id, current_user.role)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{mo_id}/cek-stok")
async def cek_stok_mo(
    mo_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*STATUS_ROLES)),
):
    """Cek ketersediaan semua bahan baku untuk MO ini."""
    service = MOService(db)
    try:
        return await service.check_stok_availability(mo_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))
