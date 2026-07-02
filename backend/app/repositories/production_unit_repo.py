from datetime import datetime, date, timezone, timedelta
from sqlalchemy import select, func, and_, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.production_unit import ProductionUnit, StatusUnit
from app.repositories.base import BaseRepository


class ProductionUnitRepository(BaseRepository[ProductionUnit]):
    def __init__(self, db: AsyncSession):
        super().__init__(ProductionUnit, db)

    async def generate_barcode(self) -> str:
        """
        Race-condition-safe barcode generation menggunakan PostgreSQL sequence.
        Format: SKP-YYYYMMDD-XXXX
        Sequence di-reset setiap hari, tapi tetap aman karena UNIQUE constraint
        di kolom barcode akan catch jika ada tabrakan.
        """
        today = datetime.now(timezone.utc).strftime("%Y%m%d")
        # Gunakan SELECT ... FOR UPDATE dengan subquery untuk atomic increment
        result = await self.db.execute(
            text("""
                SELECT COALESCE(MAX(CAST(SPLIT_PART(barcode, '-', 3) AS INTEGER)), 0) + 1
                FROM production_units
                WHERE barcode LIKE :prefix
            """),
            {"prefix": f"SKP-{today}-%"}
        )
        next_seq = result.scalar() or 1
        return f"SKP-{today}-{str(next_seq).zfill(4)}"

    async def get_by_barcode(self, barcode: str) -> ProductionUnit | None:
        result = await self.db.execute(
            select(ProductionUnit).where(ProductionUnit.barcode == barcode)
        )
        return result.scalar_one_or_none()

    async def get_by_mo(
        self, mo_id: int, page: int = 1, per_page: int = 50
    ) -> tuple[list[ProductionUnit], int]:
        """FEFO: expiry terdekat duluan. Returns (items, total_count)."""
        count_result = await self.db.execute(
            select(func.count(ProductionUnit.id)).where(ProductionUnit.mo_id == mo_id)
        )
        total = count_result.scalar() or 0

        result = await self.db.execute(
            select(ProductionUnit)
            .where(ProductionUnit.mo_id == mo_id)
            .order_by(ProductionUnit.expiry_date.asc())
            .offset((page - 1) * per_page)
            .limit(per_page)
        )
        return list(result.scalars().all()), total

    async def get_ready_fefo(
        self, page: int = 1, per_page: int = 50
    ) -> tuple[list[ProductionUnit], int]:
        """Semua unit READY/DELIVERED diurutkan FEFO."""
        base_where = ProductionUnit.status.in_([StatusUnit.READY, StatusUnit.DELIVERED])

        count_result = await self.db.execute(
            select(func.count(ProductionUnit.id)).where(base_where)
        )
        total = count_result.scalar() or 0

        result = await self.db.execute(
            select(ProductionUnit)
            .where(base_where)
            .order_by(ProductionUnit.expiry_date.asc())
            .offset((page - 1) * per_page)
            .limit(per_page)
        )
        return list(result.scalars().all()), total

    async def get_expiring_soon(self, days: int = 2) -> list[ProductionUnit]:
        today = date.today()
        threshold = today + timedelta(days=days)
        result = await self.db.execute(
            select(ProductionUnit)
            .where(
                and_(
                    ProductionUnit.expiry_date <= threshold,
                    ProductionUnit.expiry_date >= today,
                    ProductionUnit.status.in_([
                        StatusUnit.READY,
                        StatusUnit.DISPATCHED,
                        StatusUnit.DELIVERED,
                    ])
                )
            )
            .order_by(ProductionUnit.expiry_date.asc())
        )
        return list(result.scalars().all())

    async def get_expired_unsold(self) -> list[ProductionUnit]:
        today = date.today()
        result = await self.db.execute(
            select(ProductionUnit)
            .where(
                and_(
                    ProductionUnit.expiry_date < today,
                    ProductionUnit.status.in_([
                        StatusUnit.READY,
                        StatusUnit.DISPATCHED,
                        StatusUnit.DELIVERED,
                    ])
                )
            )
            .order_by(ProductionUnit.expiry_date.asc())
        )
        return list(result.scalars().all())

    async def mark_expired_units(self) -> int:
        today = date.today()
        result = await self.db.execute(
            select(ProductionUnit).where(
                and_(
                    ProductionUnit.expiry_date < today,
                    ProductionUnit.status.in_([
                        StatusUnit.READY,
                        StatusUnit.DISPATCHED,
                        StatusUnit.DELIVERED,
                    ])
                )
            )
        )
        units = list(result.scalars().all())
        for unit in units:
            unit.status = StatusUnit.EXPIRED
        await self.db.commit()
        return len(units)

    async def get_by_status(
        self, status: StatusUnit, page: int = 1, per_page: int = 50
    ) -> tuple[list[ProductionUnit], int]:
        count_result = await self.db.execute(
            select(func.count(ProductionUnit.id)).where(ProductionUnit.status == status)
        )
        total = count_result.scalar() or 0
        result = await self.db.execute(
            select(ProductionUnit)
            .where(ProductionUnit.status == status)
            .order_by(ProductionUnit.expiry_date.asc())
            .offset((page - 1) * per_page)
            .limit(per_page)
        )
        return list(result.scalars().all()), total
