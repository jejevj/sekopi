from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.loading import LoadingItem, LoadingOrder, StatusLoading


class LoadingRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, loading_id: int) -> Optional[LoadingOrder]:
        return await self.db.get(LoadingOrder, loading_id)

    async def get_by_nomor(self, nomor: str) -> Optional[LoadingOrder]:
        result = await self.db.execute(select(LoadingOrder).where(LoadingOrder.nomor_loading == nomor))
        return result.scalar_one_or_none()

    async def list_all(self, gerobak_id: Optional[int] = None, status: Optional[StatusLoading] = None) -> list[LoadingOrder]:
        q = select(LoadingOrder)
        if gerobak_id:
            q = q.where(LoadingOrder.gerobak_id == gerobak_id)
        if status:
            q = q.where(LoadingOrder.status == status)
        q = q.order_by(LoadingOrder.id.desc())
        result = await self.db.execute(q)
        return list(result.scalars().all())

    async def create(self, obj: LoadingOrder) -> LoadingOrder:
        self.db.add(obj)
        await self.db.commit()
        await self.db.refresh(obj)
        return obj

    async def add_item(self, item: LoadingItem) -> LoadingItem:
        self.db.add(item)
        await self.db.commit()
        await self.db.refresh(item)
        return item

    async def remove_item(self, item: LoadingItem) -> None:
        await self.db.delete(item)
        await self.db.commit()

    async def get_item_by_unit(self, loading_id: int, unit_id: int) -> Optional[LoadingItem]:
        result = await self.db.execute(
            select(LoadingItem).where(
                LoadingItem.loading_order_id == loading_id,
                LoadingItem.production_unit_id == unit_id,
            )
        )
        return result.scalar_one_or_none()

    async def save(self, obj: LoadingOrder) -> LoadingOrder:
        await self.db.commit()
        await self.db.refresh(obj)
        return obj

    async def delete(self, obj: LoadingOrder) -> None:
        await self.db.delete(obj)
        await self.db.commit()
