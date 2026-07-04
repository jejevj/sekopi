from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_roles
from app.models.user import User, UserRole
from app.repositories.mo_repo import MORepository
from app.schemas.manufacturing_order import (
    EstimasiHargaModalResponse,
    EstimasiHargaModalLineDetail,
    ManufacturingOrderCreate,
    ManufacturingOrderResponse,
    ManufacturingOrderUpdate,
    ManufacturingOrderUpdateStatus,
    MOBahanBakuResponse,
    MOLineResponse,
    UserShortResponse,
)
from app.services.mo_service import MOService

router = APIRouter()

VIEW_ROLES   = (UserRole.ADMIN, UserRole.PRODUKSI, UserRole.INVENTORI, UserRole.SHAREHOLDER)
CREATE_ROLES = (UserRole.ADMIN, UserRole.PRODUKSI)
STATUS_ROLES = (UserRole.ADMIN, UserRole.PRODUKSI, UserRole.INVENTORI)


def _hitung_estimasi_line(line) -> float | None:
    """Hitung estimasi harga modal per unit untuk satu MOLine."""
    total = 0.0
    for bb in line.bahan_baku_lines or []:
        bahan = bb.bahan_baku
        if bahan is None or bahan.harga_beli_per_satuan is None or bb.qty_per_unit is None:
            return None
        total += float(bahan.harga_beli_per_satuan) * float(bb.qty_per_unit)
    return round(total, 2) if total > 0 else None


def _build_line_response(line) -> MOLineResponse:
    bahan_list = [
        MOBahanBakuResponse(
            id=bb.id,
            bahan_baku_id=bb.bahan_baku_id,
            qty_rencana=float(bb.qty_rencana),
            qty_per_unit=float(bb.qty_per_unit) if bb.qty_per_unit is not None else None,
            qty_aktual=float(bb.qty_aktual) if bb.qty_aktual is not None else None,
            satuan=bb.satuan,
            nama_bahan=bb.bahan_baku.nama if bb.bahan_baku else f"ID-{bb.bahan_baku_id}",
            harga_beli_per_satuan=float(bb.bahan_baku.harga_beli_per_satuan)
                if bb.bahan_baku and bb.bahan_baku.harga_beli_per_satuan is not None else None,
        )
        for bb in (line.bahan_baku_lines or [])
    ]
    return MOLineResponse(
        id=line.id,
        menu_id=line.menu_id,
        nama_produk=line.nama_produk,
        target_qty=float(line.target_qty),
        satuan=line.satuan,
        created_at=line.created_at,
        bahan_baku_lines=bahan_list,
        estimasi_harga_modal=_hitung_estimasi_line(line),
    )


def _build_response(mo) -> ManufacturingOrderResponse:
    lines = [_build_line_response(line) for line in (mo.lines or [])]

    # Hitung estimasi total MO (None jika salah satu line tidak lengkap)
    estimasi_total: float | None = 0.0
    for lr in lines:
        if lr.estimasi_harga_modal is None:
            estimasi_total = None
            break
        # estimasi total = sum(estimasi_per_unit * target_qty) per line
        estimasi_total += lr.estimasi_harga_modal * lr.target_qty  # type: ignore[operator]
    if estimasi_total is not None:
        estimasi_total = round(estimasi_total, 2)

    return ManufacturingOrderResponse(
        id=mo.id,
        nomor_mo=mo.nomor_mo,
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
        lines=lines,
        created_by_user=UserShortResponse.model_validate(mo.created_by_user) if mo.created_by_user else None,
        approved_by_user=UserShortResponse.model_validate(mo.approved_by_user) if mo.approved_by_user else None,
        inventori_by_user=UserShortResponse.model_validate(mo.inventori_by_user) if mo.inventori_by_user else None,
        estimasi_harga_modal_total=estimasi_total,
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
    """Hitung estimasi harga modal per unit per line dari BOM + harga beli bahan baku."""
    repo = MORepository(db)
    mo = await repo.get_with_lines(mo_id)
    if not mo:
        raise HTTPException(status_code=404, detail="Manufacturing Order tidak ditemukan")

    mo_semua_tersedia = True
    mo_total = 0.0
    lines_detail: list[EstimasiHargaModalLineDetail] = []

    for line in mo.lines or []:
        line_total = 0.0
        line_semua = True
        bahan_detail = []
        for bb in line.bahan_baku_lines or []:
            bahan = bb.bahan_baku
            harga = float(bahan.harga_beli_per_satuan) if bahan and bahan.harga_beli_per_satuan else None
            qpu   = float(bb.qty_per_unit) if bb.qty_per_unit is not None else None
            kontribusi = round(harga * qpu, 4) if harga and qpu else None
            if kontribusi is None:
                line_semua = False
                mo_semua_tersedia = False
            else:
                line_total += kontribusi
            bahan_detail.append({
                "bahan_baku_id":         bb.bahan_baku_id,
                "nama_bahan":            bahan.nama if bahan else f"ID-{bb.bahan_baku_id}",
                "satuan":                bb.satuan,
                "qty_per_unit":          qpu,
                "harga_beli_per_satuan": harga,
                "kontribusi_per_unit":   kontribusi,
                "keterangan": None if (harga and qpu) else
                    ("harga_beli belum diset" if harga is None else "qty_per_unit belum diset"),
            })
        estimasi_per_unit  = round(line_total, 2) if line_semua else None
        estimasi_total_line = round(line_total * float(line.target_qty), 2) if line_semua else None
        if estimasi_total_line:
            mo_total += estimasi_total_line
        lines_detail.append(EstimasiHargaModalLineDetail(
            mo_line_id=line.id,
            nama_produk=line.nama_produk,
            target_qty=float(line.target_qty),
            satuan=line.satuan,
            estimasi_per_unit=estimasi_per_unit,
            estimasi_total_line=estimasi_total_line,
            semua_harga_tersedia=line_semua,
            bahan=bahan_detail,
        ))

    return EstimasiHargaModalResponse(
        mo_id=mo_id,
        nomor_mo=mo.nomor_mo,
        estimasi_total_mo=round(mo_total, 2) if mo_semua_tersedia else None,
        semua_harga_tersedia=mo_semua_tersedia,
        lines=lines_detail,
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
