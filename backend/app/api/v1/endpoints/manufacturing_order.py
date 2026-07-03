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
    MOBahanBakuResponse,
    UserShortResponse,
)
from app.services.mo_service import MOService

router = APIRouter()

VIEW_ROLES   = (UserRole.ADMIN, UserRole.PRODUKSI, UserRole.INVENTORI, UserRole.SHAREHOLDER)
CREATE_ROLES = (UserRole.ADMIN, UserRole.PRODUKSI)
STATUS_ROLES = (UserRole.ADMIN, UserRole.PRODUKSI, UserRole.INVENTORI)


def _build_response(mo) -> ManufacturingOrderResponse:
    """Serialize ORM object ke Pydantic response, isi field yang butuh resolusi relasi."""
    lines = [
        MOBahanBakuResponse(
            id=line.id,
            bahan_baku_id=line.bahan_baku_id,
            qty_rencana=float(line.qty_rencana),
            qty_aktual=float(line.qty_aktual) if line.qty_aktual is not None else None,
            satuan=line.satuan,
            nama_bahan=line.bahan_baku.nama if line.bahan_baku else f"ID-{line.bahan_baku_id}",
        )
        for line in (mo.bahan_baku_lines or [])
    ]
    return ManufacturingOrderResponse(
        id=mo.id,
        nomor_mo=mo.nomor_mo,
        nama_produk=mo.nama_produk,
        target_qty=float(mo.target_qty),
        satuan=mo.satuan,
        tanggal_rencana=mo.tanggal_rencana,
        tanggal_mulai=mo.tanggal_mulai,
        tanggal_selesai=mo.tanggal_selesai,
        status=mo.status,
        catatan=mo.catatan,
        created_by=mo.created_by,
        approved_by=mo.approved_by,
        approved_at=mo.approved_at,
        inventori_by=mo.inventori_by,
        inventori_at=mo.inventori_at,
        created_at=mo.created_at,
        bahan_baku_lines=lines,
        created_by_user=UserShortResponse.model_validate(mo.created_by_user) if mo.created_by_user else None,
        approved_by_user=UserShortResponse.model_validate(mo.approved_by_user) if mo.approved_by_user else None,
        inventori_by_user=UserShortResponse.model_validate(mo.inventori_by_user) if mo.inventori_by_user else None,
    )


@router.get("/", response_model=list[ManufacturingOrderResponse])
async def list_mo(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*VIEW_ROLES)),
):
    repo = MORepository(db)
    mos, _ = await repo.get_all_paginated(per_page=100)
    return [_build_response(mo) for mo in mos]


@router.post("/", response_model=ManufacturingOrderResponse, status_code=status.HTTP_201_CREATED)
async def create_mo(
    payload: ManufacturingOrderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*CREATE_ROLES)),
):
    service = MOService(db)
    mo = await service.create_mo(payload, current_user.id)
    # Reload dengan eager-load
    repo = MORepository(db)
    mo = await repo.get_with_lines(mo.id)
    return _build_response(mo)


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
    return _build_response(mo)


@router.patch("/{mo_id}", response_model=ManufacturingOrderResponse)
async def update_mo(
    mo_id: int,
    payload: ManufacturingOrderUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*CREATE_ROLES)),
):
    service = MOService(db)
    try:
        mo = await service.update_mo(mo_id, payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    repo = MORepository(db)
    mo = await repo.get_with_lines(mo.id)
    return _build_response(mo)


@router.post("/{mo_id}/status", response_model=ManufacturingOrderResponse)
async def update_status(
    mo_id: int,
    payload: ManufacturingOrderUpdateStatus,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*STATUS_ROLES)),
):
    service = MOService(db)
    try:
        mo = await service.update_status(mo_id, payload, current_user.id, current_user.role)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    repo = MORepository(db)
    mo = await repo.get_with_lines(mo.id)
    return _build_response(mo)


@router.get("/{mo_id}/cek-stok")
async def cek_stok_mo(
    mo_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*STATUS_ROLES)),
):
    service = MOService(db)
    try:
        return await service.check_stok_availability(mo_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))
