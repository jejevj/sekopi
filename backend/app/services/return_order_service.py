from datetime import datetime, timezone
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundException
from app.models.return_order import (
    ReturnOrder, ReturnItem,
    StatusReturnOrder, KategoriReturn, KondisiKonfirmasi,
)
from app.models.loading import LoadingOrder, StatusLoading
from app.models.production_unit import ProductionUnit, StatusUnit
from app.models.user import UserRole
from app.schemas.return_order import ReturnOrderCreate, ReviewReturnOrderRequest


class ReturnOrderService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _generate_nomor_return(self) -> str:
        today = datetime.now(timezone.utc).strftime("%Y%m%d")
        prefix = f"RET-{today}-"
        result = await self.db.execute(
            select(func.count(ReturnOrder.id)).where(
                ReturnOrder.nomor_return.like(f"{prefix}%")
            )
        )
        count = result.scalar() or 0
        return f"{prefix}{str(count + 1).zfill(3)}"

    async def get_my_loading_today(
        self, driver_id: int, user_role: UserRole
    ) -> list[LoadingOrder]:
        today_start = datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        today_end = today_start.replace(hour=23, minute=59, second=59, microsecond=999999)

        base_filter = [
            LoadingOrder.status.in_([
                StatusLoading.DISPATCHED,
                StatusLoading.RETURNED,
            ]),
            LoadingOrder.created_at >= today_start,
            LoadingOrder.created_at <= today_end,
        ]

        if user_role == UserRole.DRIVER:
            base_filter.append(LoadingOrder.driver_id == driver_id)

        result = await self.db.execute(
            select(LoadingOrder)
            .where(*base_filter)
            .order_by(LoadingOrder.created_at.desc())
        )
        return list(result.scalars().all())

    async def create_return(
        self, payload: ReturnOrderCreate, driver_id: int, user_role: UserRole
    ) -> ReturnOrder:
        loading_order = await self._validate_loading_for_driver(
            payload.loading_order_id, driver_id, user_role
        )

        # Kumpulkan semua barcode yang ada di loading ini
        loading_barcodes = {item.barcode_snapshot for item in loading_order.items}

        validated_items = []
        errors = []
        for item in payload.items:
            result = await self.db.execute(
                select(ProductionUnit).where(ProductionUnit.barcode == item.barcode)
            )
            unit = result.scalar_one_or_none()
            if not unit:
                errors.append(f"Barcode {item.barcode} tidak ditemukan")
                continue
            if item.barcode not in loading_barcodes:
                errors.append(
                    f"Barcode {item.barcode} bukan bagian dari loading {loading_order.nomor_loading}"
                )
                continue
            if unit.status == StatusUnit.SOLD:
                errors.append(f"Barcode {item.barcode} sudah terjual, tidak bisa diretur")
                continue
            if unit.status in [StatusUnit.VOID, StatusUnit.EXPIRED]:
                errors.append(f"Barcode {item.barcode} berstatus {unit.status}, tidak bisa diretur")
                continue
            validated_items.append((item, unit))

        if errors:
            raise ValueError("Validasi gagal: " + " | ".join(errors))

        nomor_return = await self._generate_nomor_return()
        return_order = ReturnOrder(
            nomor_return=nomor_return,
            loading_order_id=loading_order.id,
            driver_id=driver_id,
            catatan_driver=payload.catatan_driver,
            status=StatusReturnOrder.DRAFT,
        )
        self.db.add(return_order)
        await self.db.flush()

        now = datetime.now(timezone.utc)
        for item_payload, unit in validated_items:
            return_item = ReturnItem(
                return_order_id=return_order.id,
                production_unit_id=unit.id,
                barcode=unit.barcode,
                mo_id=unit.mo_id,
                kategori=item_payload.kategori,
                catatan_driver=item_payload.catatan_driver,
                kondisi_konfirmasi=KondisiKonfirmasi.PENDING,
            )
            self.db.add(return_item)
            unit.returned_at = now
            if item_payload.kategori == KategoriReturn.RUSAK:
                unit.status = StatusUnit.RETURNED_DAMAGED
            else:
                unit.status = StatusUnit.RETURNED_GOOD

        await self.db.commit()
        await self.db.refresh(return_order)
        return return_order

    async def _validate_loading_for_driver(
        self, loading_order_id: int, driver_id: int, user_role: UserRole
    ) -> LoadingOrder:
        result = await self.db.execute(
            select(LoadingOrder).where(LoadingOrder.id == loading_order_id)
        )
        lo = result.scalar_one_or_none()
        if not lo:
            raise ValueError(f"Loading order ID {loading_order_id} tidak ditemukan")
        if user_role == UserRole.DRIVER and lo.driver_id != driver_id:
            raise ValueError(
                "Anda hanya bisa membuat return untuk loading order milik Anda sendiri"
            )
        today_start = datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        if lo.created_at < today_start:
            raise ValueError("Return hanya bisa dibuat untuk loading order hari ini")
        if lo.status not in (StatusLoading.DISPATCHED, StatusLoading.RETURNED):
            raise ValueError(
                f"Loading order harus berstatus dispatched untuk bisa di-return "
                f"(saat ini: {lo.status})"
            )
        return lo

    async def submit_return(self, return_id: int, driver_id: int) -> ReturnOrder:
        ro = await self._get_or_404(return_id)
        if ro.driver_id != driver_id:
            raise ValueError("Hanya driver yang membuat return ini yang bisa submit")
        if ro.status != StatusReturnOrder.DRAFT:
            raise ValueError(f"Return order sudah berstatus {ro.status}")
        ro.status = StatusReturnOrder.SUBMITTED
        await self.db.commit()
        await self.db.refresh(ro)
        return ro

    async def review_return(
        self, return_id: int, payload: ReviewReturnOrderRequest, reviewer_id: int
    ) -> ReturnOrder:
        ro = await self._get_or_404(return_id)
        if ro.status != StatusReturnOrder.SUBMITTED:
            raise ValueError("Return order harus berstatus SUBMITTED untuk direview")

        item_map = {item.id: item for item in ro.items}
        for review in payload.items:
            ret_item = item_map.get(review.return_item_id)
            if not ret_item:
                raise ValueError(f"Return item ID {review.return_item_id} tidak ditemukan")
            ret_item.kondisi_konfirmasi = review.kondisi_konfirmasi
            ret_item.catatan_reviewer = review.catatan_reviewer
            result = await self.db.execute(
                select(ProductionUnit).where(
                    ProductionUnit.id == ret_item.production_unit_id
                )
            )
            unit = result.scalar_one_or_none()
            if not unit:
                continue
            if review.kondisi_konfirmasi == KondisiKonfirmasi.BAIK:
                unit.status = StatusUnit.READY
                unit.pengiriman_id = None
            elif review.kondisi_konfirmasi == KondisiKonfirmasi.RUSAK_KONFIRMASI:
                unit.status = StatusUnit.VOID
                unit.void_reason = (
                    f"Rusak dikonfirmasi saat retur {ro.nomor_return}. "
                    f"Catatan: {review.catatan_reviewer or '-'}"
                )
                unit.voided_at = datetime.now(timezone.utc)

        ro.status = StatusReturnOrder.REVIEWED
        ro.reviewed_by = reviewer_id
        ro.reviewed_at = datetime.now(timezone.utc)
        ro.catatan_reviewer = payload.catatan_reviewer
        await self.db.commit()
        await self.db.refresh(ro)
        return ro

    async def get_return_summary(self, return_id: int) -> dict:
        ro = await self._get_or_404(return_id)
        total_sisa  = sum(1 for i in ro.items if i.kategori == KategoriReturn.SISA)
        total_rusak = sum(1 for i in ro.items if i.kategori == KategoriReturn.RUSAK)
        total_rusak_konfirmasi = sum(
            1 for i in ro.items if i.kondisi_konfirmasi == KondisiKonfirmasi.RUSAK_KONFIRMASI
        )
        total_baik_konfirmasi = sum(
            1 for i in ro.items if i.kondisi_konfirmasi == KondisiKonfirmasi.BAIK
        )
        total_pending = sum(
            1 for i in ro.items if i.kondisi_konfirmasi == KondisiKonfirmasi.PENDING
        )
        batch_summary: dict[int, dict] = {}
        for item in ro.items:
            if item.mo_id not in batch_summary:
                batch_summary[item.mo_id] = {"mo_id": item.mo_id, "sisa": 0, "rusak": 0}
            if item.kategori == KategoriReturn.SISA:
                batch_summary[item.mo_id]["sisa"] += 1
            else:
                batch_summary[item.mo_id]["rusak"] += 1

        loading_info = None
        if ro.loading_order:
            loading_info = {
                "id": ro.loading_order.id,
                "nomor_loading": ro.loading_order.nomor_loading,
            }
        return {
            "nomor_return": ro.nomor_return,
            "status": ro.status,
            "loading_order": loading_info,
            "total_item": len(ro.items),
            "total_sisa": total_sisa,
            "total_rusak": total_rusak,
            "total_rusak_konfirmasi": total_rusak_konfirmasi,
            "total_baik_konfirmasi": total_baik_konfirmasi,
            "total_pending_review": total_pending,
            "by_batch": list(batch_summary.values()),
        }

    async def _get_or_404(self, return_id: int) -> ReturnOrder:
        result = await self.db.execute(
            select(ReturnOrder).where(ReturnOrder.id == return_id)
        )
        ro = result.scalar_one_or_none()
        if not ro:
            raise NotFoundException(f"Return Order ID {return_id} tidak ditemukan")
        return ro
