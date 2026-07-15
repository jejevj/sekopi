from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.loading import LoadingItem, LoadingOrder, StatusLoading
from app.models.production_unit import ProductionUnit, StatusUnit
from app.models.user import UserRole
from app.repositories.loading import LoadingRepository
from app.schemas.loading import (
    LoadingOrderCreate, LoadingOrderResponse, LoadingOrderUpdate, ScanItemRequest,
)


async def _nomor_loading(db: AsyncSession) -> str:
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    result = await db.execute(
        text("SELECT COUNT(*) FROM loading_orders WHERE nomor_loading LIKE :prefix"),
        {"prefix": f"LD-{today}%"},
    )
    count = result.scalar() or 0
    return f"LD-{today}-{count + 1:04d}"


class LoadingService:
    def __init__(self, repo: LoadingRepository, db: AsyncSession):
        self.repo = repo
        self.db = db

    async def create(self, data: LoadingOrderCreate, dibuat_oleh: int) -> LoadingOrderResponse:
        nomor = await _nomor_loading(self.db)
        obj = LoadingOrder(
            nomor_loading=nomor,
            gerobak_id=data.gerobak_id,
            driver_id=data.driver_id,
            dibuat_oleh=dibuat_oleh,
            catatan=data.catatan,
        )
        obj = await self.repo.create(obj)
        return LoadingOrderResponse.from_orm_obj(obj)

    async def get(self, loading_id: int) -> LoadingOrderResponse:
        obj = await self.repo.get_by_id(loading_id)
        if not obj:
            raise HTTPException(status_code=404, detail="Loading order tidak ditemukan")
        return LoadingOrderResponse.from_orm_obj(obj)

    async def list_all(
        self,
        gerobak_id=None,
        status=None,
        current_user_id: int | None = None,
        current_user_role: str | None = None,
    ) -> list[LoadingOrderResponse]:
        # Admin & inventori bisa lihat semua
        if current_user_role in (UserRole.ADMIN, UserRole.INVENTORI):
            objs = await self.repo.list_all(gerobak_id=gerobak_id, status=status)
        else:
            # Driver & role lain hanya lihat loading yang terkait dengan mereka
            objs = await self.repo.list_all(
                gerobak_id=gerobak_id,
                status=status,
                driver_id=current_user_id,
                dibuat_oleh=current_user_id,
            )
        return [LoadingOrderResponse.from_orm_obj(o) for o in objs]

    async def update_status(self, loading_id: int, data: LoadingOrderUpdate) -> LoadingOrderResponse:
        obj = await self.repo.get_by_id(loading_id)
        if not obj:
            raise HTTPException(status_code=404, detail="Loading order tidak ditemukan")

        transitions = {
            StatusLoading.DRAFT:      [StatusLoading.CONFIRMED],
            StatusLoading.CONFIRMED:  [StatusLoading.DISPATCHED],
            StatusLoading.DISPATCHED: [StatusLoading.RETURNED],
        }
        if data.status and data.status not in transitions.get(obj.status, []):
            raise HTTPException(
                status_code=400,
                detail=f"Tidak bisa ubah status dari {obj.status} ke {data.status}",
            )

        if data.status == StatusLoading.DISPATCHED:
            for item in obj.items:
                pu = await self.db.get(ProductionUnit, item.production_unit_id)
                if pu and pu.status == StatusUnit.READY:
                    pu.status = StatusUnit.DISPATCHED

        if data.status:
            obj.status = data.status
        if data.catatan is not None:
            obj.catatan = data.catatan

        obj = await self.repo.save(obj)
        return LoadingOrderResponse.from_orm_obj(obj)

    async def scan_item(self, loading_id: int, req: ScanItemRequest) -> LoadingOrderResponse:
        obj = await self.repo.get_by_id(loading_id)
        if not obj:
            raise HTTPException(status_code=404, detail="Loading order tidak ditemukan")
        if obj.status != StatusLoading.DRAFT:
            raise HTTPException(status_code=400, detail="Hanya loading berstatus DRAFT yang bisa di-scan")

        from sqlalchemy import select
        pu_result = await self.db.execute(
            select(ProductionUnit).where(ProductionUnit.barcode == req.barcode)
        )
        pu = pu_result.scalar_one_or_none()
        if not pu:
            raise HTTPException(status_code=404, detail=f"Barcode '{req.barcode}' tidak ditemukan")
        if pu.status != StatusUnit.READY:
            raise HTTPException(
                status_code=400,
                detail=f"Unit {req.barcode} berstatus {pu.status} — hanya READY yang bisa diloading",
            )

        existing = await self.repo.get_item_by_unit(loading_id, pu.id)
        if existing:
            raise HTTPException(status_code=409, detail=f"Barcode '{req.barcode}' sudah ada di loading ini")

        item = LoadingItem(
            loading_order_id=loading_id,
            production_unit_id=pu.id,
            barcode_snapshot=pu.barcode,
            harga_modal_snapshot=pu.harga_modal,
        )
        await self.repo.add_item(item)
        await self.db.refresh(obj)
        return LoadingOrderResponse.from_orm_obj(obj)

    async def remove_item(self, loading_id: int, item_id: int) -> LoadingOrderResponse:
        obj = await self.repo.get_by_id(loading_id)
        if not obj:
            raise HTTPException(status_code=404, detail="Loading order tidak ditemukan")
        if obj.status != StatusLoading.DRAFT:
            raise HTTPException(status_code=400, detail="Hanya loading DRAFT yang bisa diedit")
        item = next((i for i in obj.items if i.id == item_id), None)
        if not item:
            raise HTTPException(status_code=404, detail="Item tidak ditemukan")
        await self.repo.remove_item(item)
        await self.db.refresh(obj)
        return LoadingOrderResponse.from_orm_obj(obj)

    async def delete(self, loading_id: int) -> None:
        obj = await self.repo.get_by_id(loading_id)
        if not obj:
            raise HTTPException(status_code=404, detail="Loading order tidak ditemukan")
        if obj.status != StatusLoading.DRAFT:
            raise HTTPException(status_code=400, detail="Hanya loading DRAFT yang bisa dihapus")
        await self.repo.delete(obj)
