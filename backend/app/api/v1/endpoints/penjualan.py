from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_roles
from app.models.user import User, UserRole
from app.models.penjualan import Penjualan
from app.models.gerobak import Gerobak, ShareholderGroup
from app.models.user import User as UserModel
from app.schemas.penjualan import PenjualanListItem, PenjualanListResponse
from app.core.timezone import parse_datetime_wib, WIB

router = APIRouter()


@router.get("/", response_model=PenjualanListResponse)
async def list_penjualan(
    dari: str | None = Query(None, description="Datetime awal WIB, format: 2026-07-04T00:00 atau 2026-07-04"),
    sampai: str | None = Query(None, description="Datetime akhir WIB, format: 2026-07-04T23:59 atau 2026-07-04"),
    gerobak_id: int | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.SHAREHOLDER)),
):
    """
    List semua transaksi penjualan, join gerobak + driver + grup saham.
    Filter dari/sampai mendukung datetime lengkap (jam & menit) dalam timezone WIB.
    ADMIN: lihat semua. SHAREHOLDER: otomatis filter ke gerobak di grupnya.
    """
    conds = []

    if dari:
        dt_dari = parse_datetime_wib(dari)
        # Kalau hanya tanggal (jam=00:00), defaultkan ke awal hari
        conds.append(Penjualan.sold_at >= dt_dari)

    if sampai:
        dt_sampai = parse_datetime_wib(sampai)
        # Kalau hanya tanggal, defaultkan ke akhir hari
        if len(sampai.strip()) == 10:  # format YYYY-MM-DD
            from datetime import timedelta
            dt_sampai = dt_sampai.replace(hour=23, minute=59, second=59)
        conds.append(Penjualan.sold_at <= dt_sampai)

    if gerobak_id:
        conds.append(Penjualan.gerobak_id == gerobak_id)

    # Shareholder hanya bisa lihat gerobak di grupnya
    if current_user.role == UserRole.SHAREHOLDER:
        from app.models.gerobak import GroupMembership
        subq = (
            select(Gerobak.id)
            .join(ShareholderGroup, Gerobak.shareholder_group_id == ShareholderGroup.id)
            .join(GroupMembership, GroupMembership.group_id == ShareholderGroup.id)
            .where(GroupMembership.user_id == current_user.id)
        )
        conds.append(Penjualan.gerobak_id.in_(subq))

    where_clause = and_(*conds) if conds else True

    # Count total
    count_q = select(func.count(Penjualan.id)).where(where_clause)
    total = (await db.execute(count_q)).scalar() or 0

    # Fetch page
    q = (
        select(Penjualan)
        .where(where_clause)
        .order_by(Penjualan.sold_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    rows = (await db.execute(q)).scalars().all()

    items = []
    for p in rows:
        g: Gerobak | None = p.gerobak
        kasir: UserModel | None = p.kasir
        grup: ShareholderGroup | None = g.shareholder_group if g else None

        items.append(PenjualanListItem(
            id=p.id,
            production_unit_id=p.production_unit_id,
            barcode=p.barcode,
            nama_produk=p.nama_produk,
            harga=float(p.harga),
            catatan=p.catatan,
            sold_at=p.sold_at,
            kasir_id=p.kasir_id,
            kasir_nama=kasir.full_name if kasir else None,
            gerobak_id=g.id if g else None,
            gerobak_nama=g.nama if g else None,
            gerobak_kode=g.kode if g else None,
            gerobak_lokasi=g.lokasi if g else None,
            grup_id=grup.id if grup else None,
            grup_nama=grup.nama if grup else None,
        ))

    return PenjualanListResponse(
        total=total,
        page=page,
        per_page=per_page,
        total_pages=max(1, -(-total // per_page)),
        items=items,
    )
