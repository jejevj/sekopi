from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.loading import LoadingItem, LoadingOrder, StatusLoading
from app.models.production_unit import ProductionUnit, StatusUnit
from app.repositories.loading import LoadingRepository
from app.schemas.loading import (
    LoadingOrderCreate, LoadingOrderResponse, LoadingOrderUpdate, ScanItemRequest,
)


def _nomor_loading(db_session: Session) -> str:
    from sqlalchemy import text
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    result = db_session.execute(
        text("SELECT COUNT(*) FROM loading_orders WHERE nomor_loading LIKE :prefix"),
        {"prefix": f"LD-{today}%"},
    ).scalar() or 0
    return f"LD-{today}-{result + 1:04d}"


class LoadingService:
    def __init__(self, repo: LoadingRepository, db: Session):
        self.repo = repo
        self.db = db

    def create(self, data: LoadingOrderCreate, dibuat_oleh: int) -> LoadingOrderResponse:
        nomor = _nomor_loading(self.db)
        obj = LoadingOrder(
            nomor_loading=nomor,
            gerobak_id=data.gerobak_id,
            driver_id=data.driver_id,
            dibuat_oleh=dibuat_oleh,
            catatan=data.catatan,
        )
        obj = self.repo.create(obj)
        return LoadingOrderResponse.from_orm_obj(obj)

    def get(self, loading_id: int) -> LoadingOrderResponse:
        obj = self.repo.get_by_id(loading_id)
        if not obj:
            raise HTTPException(status_code=404, detail="Loading order tidak ditemukan")
        return LoadingOrderResponse.from_orm_obj(obj)

    def list_all(self, gerobak_id=None, status=None) -> list[LoadingOrderResponse]:
        objs = self.repo.list_all(gerobak_id=gerobak_id, status=status)
        return [LoadingOrderResponse.from_orm_obj(o) for o in objs]

    def update_status(self, loading_id: int, data: LoadingOrderUpdate) -> LoadingOrderResponse:
        obj = self.repo.get_by_id(loading_id)
        if not obj:
            raise HTTPException(status_code=404, detail="Loading order tidak ditemukan")

        transitions = {
            StatusLoading.DRAFT:     [StatusLoading.CONFIRMED],
            StatusLoading.CONFIRMED: [StatusLoading.DISPATCHED],
            StatusLoading.DISPATCHED:[StatusLoading.RETURNED],
        }
        if data.status and data.status not in transitions.get(obj.status, []):
            raise HTTPException(
                status_code=400,
                detail=f"Tidak bisa ubah status dari {obj.status} ke {data.status}",
            )

        # Saat DISPATCHED: ubah semua unit menjadi DISPATCHED
        if data.status == StatusLoading.DISPATCHED:
            for item in obj.items:
                pu = self.db.get(ProductionUnit, item.production_unit_id)
                if pu and pu.status == StatusUnit.READY:
                    pu.status = StatusUnit.DISPATCHED

        if data.status:
            obj.status = data.status
        if data.catatan is not None:
            obj.catatan = data.catatan

        obj = self.repo.save(obj)
        return LoadingOrderResponse.from_orm_obj(obj)

    def scan_item(self, loading_id: int, req: ScanItemRequest) -> LoadingOrderResponse:
        """Scan barcode → tambah unit ke loading."""
        obj = self.repo.get_by_id(loading_id)
        if not obj:
            raise HTTPException(status_code=404, detail="Loading order tidak ditemukan")
        if obj.status != StatusLoading.DRAFT:
            raise HTTPException(status_code=400, detail="Hanya loading berstatus DRAFT yang bisa di-scan")

        from sqlalchemy import select
        pu = self.db.scalar(
            select(ProductionUnit).where(ProductionUnit.barcode == req.barcode)
        )
        if not pu:
            raise HTTPException(status_code=404, detail=f"Barcode '{req.barcode}' tidak ditemukan")
        if pu.status != StatusUnit.READY:
            raise HTTPException(
                status_code=400,
                detail=f"Unit {req.barcode} berstatus {pu.status} — hanya READY yang bisa diloading",
            )

        existing = self.repo.get_item_by_unit(loading_id, pu.id)
        if existing:
            raise HTTPException(status_code=409, detail=f"Barcode '{req.barcode}' sudah ada di loading ini")

        item = LoadingItem(
            loading_order_id=loading_id,
            production_unit_id=pu.id,
            barcode_snapshot=pu.barcode,
            harga_modal_snapshot=pu.harga_modal,
        )
        self.repo.add_item(item)
        self.db.refresh(obj)
        return LoadingOrderResponse.from_orm_obj(obj)

    def remove_item(self, loading_id: int, item_id: int) -> LoadingOrderResponse:
        obj = self.repo.get_by_id(loading_id)
        if not obj:
            raise HTTPException(status_code=404, detail="Loading order tidak ditemukan")
        if obj.status != StatusLoading.DRAFT:
            raise HTTPException(status_code=400, detail="Hanya loading DRAFT yang bisa diedit")
        item = next((i for i in obj.items if i.id == item_id), None)
        if not item:
            raise HTTPException(status_code=404, detail="Item tidak ditemukan")
        self.repo.remove_item(item)
        self.db.refresh(obj)
        return LoadingOrderResponse.from_orm_obj(obj)

    def delete(self, loading_id: int) -> None:
        obj = self.repo.get_by_id(loading_id)
        if not obj:
            raise HTTPException(status_code=404, detail="Loading order tidak ditemukan")
        if obj.status != StatusLoading.DRAFT:
            raise HTTPException(status_code=400, detail="Hanya loading DRAFT yang bisa dihapus")
        self.repo.delete(obj)
