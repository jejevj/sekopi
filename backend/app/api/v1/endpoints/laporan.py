from datetime import date, timedelta
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_roles
from app.models.user import User, UserRole
from app.schemas.laporan import LaporanUmumResponse, LaporanShareholderResponse
from app.services.laporan_service import LaporanService

router = APIRouter()


# ── Laporan Umum (ADMIN only) ─────────────────────────────────────────────────

@router.get("/umum", response_model=LaporanUmumResponse)
async def laporan_umum(
    dari: date = Query(...),
    sampai: date = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    """Laporan global semua gerobak — hanya ADMIN."""
    if sampai < dari:
        raise HTTPException(status_code=400, detail="'sampai' tidak boleh sebelum 'dari'")
    return await LaporanService(db).get_laporan_umum(dari, sampai)


@router.get("/umum/minggu-ini", response_model=LaporanUmumResponse)
async def laporan_umum_minggu(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    sampai = date.today()
    return await LaporanService(db).get_laporan_umum(sampai - timedelta(days=6), sampai)


@router.get("/umum/bulan-ini", response_model=LaporanUmumResponse)
async def laporan_umum_bulan(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
):
    today = date.today()
    return await LaporanService(db).get_laporan_umum(today.replace(day=1), today)


# ── Laporan Shareholder (per grup gerobak) ────────────────────────────────────

@router.get("/shareholder", response_model=LaporanShareholderResponse)
async def laporan_shareholder(
    dari: date = Query(...),
    sampai: date = Query(...),
    group_id: int | None = Query(None, description="Filter by grup (ADMIN only)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.SHAREHOLDER)),
):
    """
    - SHAREHOLDER: otomatis filter ke grup mereka sendiri.
    - ADMIN: bisa pass ?group_id= untuk lihat grup tertentu, atau tanpa group_id = semua data.
    """
    if sampai < dari:
        raise HTTPException(status_code=400, detail="'sampai' tidak boleh sebelum 'dari'")
    # Shareholder tidak boleh akses grup lain
    if current_user.role == UserRole.SHAREHOLDER and group_id is not None:
        raise HTTPException(status_code=403, detail="Shareholder hanya bisa lihat laporan grupnya sendiri")
    uid = current_user.id if current_user.role == UserRole.SHAREHOLDER else None
    return await LaporanService(db).get_laporan_shareholder(dari, sampai, user_id=uid, group_id=group_id)


@router.get("/shareholder/minggu-ini", response_model=LaporanShareholderResponse)
async def laporan_sh_minggu(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.SHAREHOLDER)),
):
    sampai = date.today()
    uid = current_user.id if current_user.role == UserRole.SHAREHOLDER else None
    return await LaporanService(db).get_laporan_shareholder(sampai - timedelta(days=6), sampai, user_id=uid)


@router.get("/shareholder/bulan-ini", response_model=LaporanShareholderResponse)
async def laporan_sh_bulan(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.SHAREHOLDER)),
):
    today = date.today()
    uid = current_user.id if current_user.role == UserRole.SHAREHOLDER else None
    return await LaporanService(db).get_laporan_shareholder(today.replace(day=1), today, user_id=uid)
