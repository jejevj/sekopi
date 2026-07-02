from datetime import datetime, timezone
from sqlalchemy import select, func
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
        result = await self.db.execute(
            select(ProductionUnit).where(ProductionUnit.mo_id == mo_id)
        )
        return list(result.scalars().all())

    async def get_by_status(self, status: StatusUnit) -> list[ProductionUnit]:
        result = await self.db.execute(
            select(ProductionUnit).where(ProductionUnit.status == status)
        )
        return list(result.scalars().all())
