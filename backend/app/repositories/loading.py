from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.loading import LoadingItem, LoadingOrder, StatusLoading


class LoadingRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, loading_id: int) -> Optional[LoadingOrder]:
        return self.db.get(LoadingOrder, loading_id)

    def get_by_nomor(self, nomor: str) -> Optional[LoadingOrder]:
        return self.db.scalar(select(LoadingOrder).where(LoadingOrder.nomor_loading == nomor))

    def list_all(self, gerobak_id: Optional[int] = None, status: Optional[StatusLoading] = None) -> list[LoadingOrder]:
        q = select(LoadingOrder)
        if gerobak_id:
            q = q.where(LoadingOrder.gerobak_id == gerobak_id)
        if status:
            q = q.where(LoadingOrder.status == status)
        q = q.order_by(LoadingOrder.id.desc())
        return list(self.db.scalars(q))

    def create(self, obj: LoadingOrder) -> LoadingOrder:
        self.db.add(obj)
        self.db.commit()
        self.db.refresh(obj)
        return obj

    def add_item(self, item: LoadingItem) -> LoadingItem:
        self.db.add(item)
        self.db.commit()
        self.db.refresh(item)
        return item

    def remove_item(self, item: LoadingItem) -> None:
        self.db.delete(item)
        self.db.commit()

    def get_item_by_unit(self, loading_id: int, unit_id: int) -> Optional[LoadingItem]:
        return self.db.scalar(
            select(LoadingItem).where(
                LoadingItem.loading_order_id == loading_id,
                LoadingItem.production_unit_id == unit_id,
            )
        )

    def save(self, obj: LoadingOrder) -> LoadingOrder:
        self.db.commit()
        self.db.refresh(obj)
        return obj

    def delete(self, obj: LoadingOrder) -> None:
        self.db.delete(obj)
        self.db.commit()
