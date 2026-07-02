from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_roles
from app.models.user import User, UserRole
from app.models.penjualan import Penjualan
from app.schemas.penjualan import PenjualanResponse, PenjualanSummary

router = APIRouter()

REPORT_ROLES = (UserRole.ADMIN, UserRole.SHAREHOLDER)


@router.get("/", response_model=list[PenjualanResponse])
async def list_penjualan(
    tanggal: date | None = Query(None, description="Filter by tanggal (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*REPORT_ROLES)),
):
    query = select(Penjualan).order_by(Penjualan.sold_at.desc())
    if tanggal:
        query = query.where(func.date(Penjualan.sold_at) == tanggal)
    result = await db.execute(query)
    return list(result.scalars().all())


@router.get("/summary", response_model=PenjualanSummary)
async def summary_penjualan(
    tanggal: date = Query(..., description="Tanggal summary (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(*REPORT_ROLES)),
):
    result = await db.execute(
        select(
            func.count(Penjualan.id),
            func.sum(Penjualan.harga),
        ).where(func.date(Penjualan.sold_at) == tanggal)
    )
    row = result.one()
    total_terjual = row[0] or 0
    total_pendapatan = float(row[1] or 0)
    return PenjualanSummary(
        total_terjual=total_terjual,
        total_pendapatan=total_pendapatan,
        periode=str(tanggal),
    )
