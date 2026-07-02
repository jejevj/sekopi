from datetime import datetime, timezone
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.manufacturing_order import ManufacturingOrder, MOBahanBaku
from app.repositories.base import BaseRepository


class MORepository(BaseRepository[ManufacturingOrder]):
    def __init__(self, db: AsyncSession):
        super().__init__(ManufacturingOrder, db)

    async def generate_nomor_mo(self) -> str:
        """Auto-generate nomor MO: MO-YYYYMMDD-XXX"""
        today = datetime.now(timezone.utc).strftime("%Y%m%d")
        prefix = f"MO-{today}-"
        result = await self.db.execute(
            select(func.count(ManufacturingOrder.id)).where(
                ManufacturingOrder.nomor_mo.like(f"{prefix}%")
            )
        )
        count = result.scalar() or 0
        return f"{prefix}{str(count + 1).zfill(3)}"

    async def get_with_lines(self, mo_id: int) -> ManufacturingOrder | None:
        result = await self.db.execute(
            select(ManufacturingOrder).where(ManufacturingOrder.id == mo_id)
        )
        return result.scalar_one_or_none()

    async def get_by_nomor(self, nomor_mo: str) -> ManufacturingOrder | None:
        result = await self.db.execute(
            select(ManufacturingOrder).where(ManufacturingOrder.nomor_mo == nomor_mo)
        )
        return result.scalar_one_or_none()
