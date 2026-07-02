from datetime import datetime, date, timezone, timedelta
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.production_unit import ProductionUnit, StatusUnit
from app.repositories.base import BaseRepository


class ProductionUnitRepository(BaseRepository[ProductionUnit]):
    def __init__(self, db: AsyncSession):
        super().__init__(ProductionUnit, db)

    async def generate_barcode(self) -> str:
        """Auto-generate barcode: SKP-YYYYMMDD-XXXX"""
        today = datetime.now(timezone.utc).strftime("%Y%m%d")
        prefix = f"SKP-{today}-"
        result = await self.db.execute(
            select(func.count(ProductionUnit.id)).where(
                ProductionUnit.barcode.like(f"{prefix}%")
            )
        )
        count = result.scalar() or 0
        return f"{prefix}{str(count + 1).zfill(4)}"

    async def get_by_barcode(self, barcode: str) -> ProductionUnit | None:
        result = await self.db.execute(
            select(ProductionUnit).where(ProductionUnit.barcode == barcode)
        )
        return result.scalar_one_or_none()

    async def get_by_mo(self, mo_id: int) -> list[ProductionUnit]:
        # FEFO: urutkan berdasarkan expiry_date paling dekat dulu
        result = await self.db.execute(
            select(ProductionUnit)
            .where(ProductionUnit.mo_id == mo_id)
            .order_by(ProductionUnit.expiry_date.asc())
        )
        return list(result.scalars().all())

    async def get_ready_fefo(self) -> list[ProductionUnit]:
        """Ambil semua unit READY/DELIVERED, diurutkan FEFO (expiry terdekat duluan)."""
        result = await self.db.execute(
            select(ProductionUnit)
            .where(ProductionUnit.status.in_([StatusUnit.READY, StatusUnit.DELIVERED]))
            .order_by(ProductionUnit.expiry_date.asc())
        )
        return list(result.scalars().all())

    async def get_expiring_soon(self, days: int = 2) -> list[ProductionUnit]:
        """Unit yang akan expired dalam `days` hari ke depan dan belum terjual."""
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
        """Unit yang sudah melewati expiry date tapi belum terjual/void."""
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
        """Tandai semua unit yang sudah melewati expiry date sebagai EXPIRED.
        Dipanggil oleh scheduler atau manual trigger."""
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

    async def get_by_status(self, status: StatusUnit) -> list[ProductionUnit]:
        result = await self.db.execute(
            select(ProductionUnit)
            .where(ProductionUnit.status == status)
            .order_by(ProductionUnit.expiry_date.asc())
        )
        return list(result.scalars().all())
