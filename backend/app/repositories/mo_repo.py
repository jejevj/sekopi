from datetime import datetime, timezone
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.models.manufacturing_order import ManufacturingOrder, MOLine, MOBahanBaku
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
        """
        Load MO header + semua MOLine + bahan baku per line + user relations.
        """
        result = await self.db.execute(
            select(ManufacturingOrder)
            .options(
                selectinload(ManufacturingOrder.lines)
                    .selectinload(MOLine.bahan_baku_lines)
                    .joinedload(MOBahanBaku.bahan_baku),
                selectinload(ManufacturingOrder.lines)
                    .joinedload(MOLine.menu),
                joinedload(ManufacturingOrder.created_by_user),
                joinedload(ManufacturingOrder.approved_by_user),
                joinedload(ManufacturingOrder.inventori_by_user),
            )
            .where(ManufacturingOrder.id == mo_id)
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
            .options(
                selectinload(ManufacturingOrder.lines)
                    .selectinload(MOLine.bahan_baku_lines)
                    .joinedload(MOBahanBaku.bahan_baku),
                selectinload(ManufacturingOrder.lines)
                    .joinedload(MOLine.menu),
                joinedload(ManufacturingOrder.created_by_user),
                joinedload(ManufacturingOrder.approved_by_user),
                joinedload(ManufacturingOrder.inventori_by_user),
            )
            .order_by(ManufacturingOrder.created_at.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
        )
        return list(result.scalars().all()), total
