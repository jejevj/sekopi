from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_roles
from app.models.dividen import StatusDividen
from app.models.gerobak import ShareholderGroup
from app.models.user import User, UserRole
from app.schemas.dividen import (
    KalkulasiRequest, KalkulasiPreviewResponse,
    GajiCreate, GajiResponse,
    DividenResponse, DividenBayarRequest,
    PorsiSahamUpdate,
)
from app.services.dividen_service import DividenService

router = APIRouter()
ADMIN = (UserRole.ADMIN,)
ADMIN_OR_SH = (UserRole.ADMIN, UserRole.SHAREHOLDER)


# ── Porsi Saham ───────────────────────────────────────────────────────────────

@router.get("/groups/porsi", response_model=list[dict])
async def get_porsi_semua(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(*ADMIN_OR_SH)),
):
    """Daftar semua grup beserta porsi saham & total."""
    result = await db.execute(select(ShareholderGroup).order_by(ShareholderGroup.nama))
    groups = result.scalars().all()
    total  = sum(float(g.porsi_saham) for g in groups)
    return [
        {
            "id": g.id, "nama": g.nama,
            "porsi_saham": float(g.porsi_saham),
            "total_semua_grup": round(total, 2),
            "sisa": round(100 - total, 2),
        }
        for g in groups
    ]


@router.patch("/groups/{group_id}/porsi", response_model=dict)
async def set_porsi(
    group_id: int,
    payload: PorsiSahamUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(*ADMIN)),
):
    """Set porsi saham satu grup. Validasi total tidak melebihi 100%."""
    grp = await db.get(ShareholderGroup, group_id)
    if not grp:
        raise HTTPException(404, "Grup tidak ditemukan")

    result = await db.execute(select(ShareholderGroup))
    all_groups = result.scalars().all()
    total_lain = sum(
        float(g.porsi_saham) for g in all_groups if g.id != group_id
    )
    if total_lain + payload.porsi_saham > 100:
        raise HTTPException(
            400,
            f"Total porsi akan menjadi {total_lain + payload.porsi_saham:.2f}% (melebihi 100%)"
        )

    grp.porsi_saham = payload.porsi_saham
    await db.commit()
    await db.refresh(grp)
    new_total = total_lain + payload.porsi_saham
    return {
        "id": grp.id, "nama": grp.nama,
        "porsi_saham": float(grp.porsi_saham),
        "total_semua_grup": round(new_total, 2),
        "sisa": round(100 - new_total, 2),
    }


# ── Gaji Karyawan ─────────────────────────────────────────────────────────────

@router.get("/gaji", response_model=list[GajiResponse])
async def list_gaji(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(*ADMIN)),
):
    return await DividenService(db).list_gaji()


# ── Kalkulasi & Distribusi ───────────────────────────────────────────────────

@router.post("/kalkulasi/preview", response_model=KalkulasiPreviewResponse)
async def preview_kalkulasi(
    payload: KalkulasiRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(*ADMIN)),
):
    """
    Dry-run: hitung dividen per grup berdasarkan data aktual penjualan & PO.
    Tidak menyimpan apa-apa ke DB.
    """
    try:
        return await DividenService(db).preview(payload)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/kalkulasi/konfirmasi", response_model=list[DividenResponse], status_code=201)
async def konfirmasi_kalkulasi(
    payload: KalkulasiRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*ADMIN)),
):
    """
    Simpan distribusi dividen ke DB setelah admin konfirmasi preview.
    """
    try:
        return await DividenService(db).konfirmasi(payload, current_user.id)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/", response_model=list[DividenResponse])
async def list_dividen(
    group_id: int | None = Query(None),
    status: StatusDividen | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*ADMIN_OR_SH)),
):
    svc = DividenService(db)
    # Shareholder hanya bisa lihat grup miliknya sendiri
    if current_user.role == UserRole.SHAREHOLDER and not group_id:
        # cari group_id milik user ini
        result = await db.execute(
            select(ShareholderGroup)
        )
        groups = result.scalars().all()
        my_groups = [
            g.id for g in groups
            if any(m.id == current_user.id for m in g.members)
        ]
        if not my_groups:
            return []
        all_rec = []
        for gid in my_groups:
            all_rec += await svc.list_dividen(group_id=gid, status=status)
        return all_rec
    return await svc.list_dividen(group_id=group_id, status=status)


@router.patch("/{dividen_id}/bayar", response_model=DividenResponse)
async def tandai_bayar(
    dividen_id: int,
    payload: DividenBayarRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(*ADMIN)),
):
    try:
        return await DividenService(db).tandai_bayar(dividen_id, payload.tanggal_bayar)
    except ValueError as e:
        raise HTTPException(404, str(e))
