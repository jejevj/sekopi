from datetime import date, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_roles
from app.models.user import User, UserRole
from app.schemas.laporan import LaporanShareholderResponse
from app.services.laporan_service import LaporanService

router = APIRouter()

SHAREHOLDER_ROLES = (UserRole.ADMIN, UserRole.SHAREHOLDER)


@router.get("/shareholder", response_model=LaporanShareholderResponse)
async def laporan_shareholder(
    dari: date = Query(..., description="Tanggal mulai periode (YYYY-MM-DD)"),
    sampai: date = Query(..., description="Tanggal akhir periode (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*SHAREHOLDER_ROLES)),
):
    """
    Laporan lengkap untuk shareholder:
    - Total pendapatan & penjualan harian
    - Estimasi kerugian (expired, rusak, void)
    - Efisiensi produksi per batch
    """
    if sampai < dari:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="'sampai' tidak boleh sebelum 'dari'")
    service = LaporanService(db)
    return await service.get_laporan_shareholder(dari, sampai)


@router.get("/shareholder/minggu-ini", response_model=LaporanShareholderResponse)
async def laporan_minggu_ini(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*SHAREHOLDER_ROLES)),
):
    """Shortcut: laporan 7 hari terakhir."""
    sampai = date.today()
    dari = sampai - timedelta(days=6)
    service = LaporanService(db)
    return await service.get_laporan_shareholder(dari, sampai)


@router.get("/shareholder/bulan-ini", response_model=LaporanShareholderResponse)
async def laporan_bulan_ini(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*SHAREHOLDER_ROLES)),
):
    """Shortcut: laporan bulan berjalan."""
    today = date.today()
    dari = today.replace(day=1)
    service = LaporanService(db)
    return await service.get_laporan_shareholder(dari, today)
