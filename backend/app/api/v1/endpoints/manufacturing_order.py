from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_roles
from app.models.user import User, UserRole
from app.repositories.mo_repo import MORepository
from app.schemas.manufacturing_order import (
    EstimasiHargaModalResponse,
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


def _kalkulasi_estimasi(mo) -> float | None:
    """Hitung estimasi harga modal per unit dari BOM.
    Rumus per bahan: harga_beli_per_satuan × qty_per_unit
    Jika salah satu bahan tidak punya harga → return None.
    """
    total = 0.0
    for line in mo.bahan_baku_lines or []:
        bb = line.bahan_baku
        if bb is None or bb.harga_beli_per_satuan is None or line.qty_per_unit is None:
            return None
        total += float(bb.harga_beli_per_satuan) * float(line.qty_per_unit)
    return round(total, 2) if total > 0 else None


def _build_response(mo) -> ManufacturingOrderResponse:
    lines = [
        MOBahanBakuResponse(
            id=line.id,
            bahan_baku_id=line.bahan_baku_id,
            qty_rencana=float(line.qty_rencana),
            qty_per_unit=float(line.qty_per_unit) if line.qty_per_unit is not None else None,
            qty_aktual=float(line.qty_aktual) if line.qty_aktual is not None else None,
            satuan=line.satuan,
            nama_bahan=line.bahan_baku.nama if line.bahan_baku else f"ID-{line.bahan_baku_id}",
            harga_beli_per_satuan=float(line.bahan_baku.harga_beli_per_satuan)
                if line.bahan_baku and line.bahan_baku.harga_beli_per_satuan is not None else None,
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
        estimasi_harga_modal=_kalkulasi_estimasi(mo),
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


@router.get("/{mo_id}/estimasi-harga-modal", response_model=EstimasiHargaModalResponse)
async def estimasi_harga_modal(
    mo_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*VIEW_ROLES)),
):
    """Hitung estimasi harga modal per unit produk dari BOM + harga beli bahan baku."""
    repo = MORepository(db)
    mo = await repo.get_with_lines(mo_id)
    if not mo:
        raise HTTPException(status_code=404, detail="Manufacturing Order tidak ditemukan")

    detail = []
    total = 0.0
    semua_tersedia = True

    for line in mo.bahan_baku_lines or []:
        bb = line.bahan_baku
        harga = float(bb.harga_beli_per_satuan) if bb and bb.harga_beli_per_satuan is not None else None
        qpu   = float(line.qty_per_unit) if line.qty_per_unit is not None else None
        kontribusi = round(harga * qpu, 4) if harga is not None and qpu is not None else None

        if kontribusi is None:
            semua_tersedia = False
        else:
            total += kontribusi

        detail.append({
            "bahan_baku_id"        : line.bahan_baku_id,
            "nama_bahan"           : bb.nama if bb else f"ID-{line.bahan_baku_id}",
            "satuan"               : line.satuan,
            "qty_per_unit"         : qpu,
            "harga_beli_per_satuan": harga,
            "kontribusi_per_unit"  : kontribusi,
            "keterangan"           : None if (harga and qpu) else
                                     ("harga_beli belum diset" if harga is None else "qty_per_unit belum diset"),
        })

    return EstimasiHargaModalResponse(
        mo_id=mo_id,
        nomor_mo=mo.nomor_mo,
        target_qty=float(mo.target_qty),
        satuan=mo.satuan,
        estimasi_harga_modal_per_unit=round(total, 2) if semua_tersedia else None,
        detail=detail,
        semua_harga_tersedia=semua_tersedia,
    )


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
