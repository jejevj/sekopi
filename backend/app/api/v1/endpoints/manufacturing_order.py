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

MO_ROLES = (UserRole.ADMIN, UserRole.PRODUKSI)


@router.get("/", response_model=list[ManufacturingOrderResponse])
async def list_mo(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*MO_ROLES, UserRole.INVENTORI, UserRole.SHAREHOLDER)),
):
    repo = MORepository(db)
    return await repo.get_all()


@router.post("/", response_model=ManufacturingOrderResponse, status_code=status.HTTP_201_CREATED)
async def create_mo(
    payload: ManufacturingOrderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*MO_ROLES)),
):
    service = MOService(db)
    return await service.create_mo(payload, current_user.id)


@router.get("/{mo_id}", response_model=ManufacturingOrderResponse)
async def get_mo(
    mo_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*MO_ROLES, UserRole.INVENTORI, UserRole.SHAREHOLDER)),
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
    current_user: User = Depends(require_roles(*MO_ROLES)),
):
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
    current_user: User = Depends(require_roles(*MO_ROLES)),
):
    service = MOService(db)
    try:
        return await service.update_status(mo_id, payload, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{mo_id}/cek-stok")
async def cek_stok_mo(
    mo_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*MO_ROLES, UserRole.INVENTORI)),
):
    """Cek ketersediaan semua bahan baku untuk MO ini."""
    service = MOService(db)
    try:
        return await service.check_stok_availability(mo_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))
