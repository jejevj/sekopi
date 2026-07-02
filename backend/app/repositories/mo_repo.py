from datetime import datetime, timezone
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.manufacturing_order import ManufacturingOrder
from app.repositories.base import BaseRepository


class MORepository(BaseRepository[ManufacturingOrder]):
    def __init__(self, db: AsyncSession):
        super().__init__(ManufacturingOrder, db)

    async def generate_nomor_mo(self) -> str:
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

    async def get_all_paginated(
        self, page: int = 1, per_page: int = 20
    ) -> tuple[list[ManufacturingOrder], int]:
        count_result = await self.db.execute(select(func.count(ManufacturingOrder.id)))
        total = count_result.scalar() or 0
        result = await self.db.execute(
            select(ManufacturingOrder)
            .order_by(ManufacturingOrder.created_at.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
        )
        return list(result.scalars().all()), total
