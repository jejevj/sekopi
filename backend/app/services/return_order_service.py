from datetime import datetime, timezone
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundException
from app.models.return_order import (
    ReturnOrder, ReturnItem,
    StatusReturnOrder, KategoriReturn, KondisiKonfirmasi,
)
from app.models.production_unit import ProductionUnit, StatusUnit
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

    async def create_return(self, payload: ReturnOrderCreate, driver_id: int) -> ReturnOrder:
        # Validasi setiap barcode
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
            if unit.status == StatusUnit.SOLD:
                errors.append(f"Barcode {item.barcode} sudah terjual, tidak bisa diretur")
                continue
            if unit.status in [StatusUnit.VOID, StatusUnit.EXPIRED]:
                errors.append(f"Barcode {item.barcode} berstatus {unit.status}, tidak bisa diretur")
                continue
            if unit.pengiriman_id != payload.pengiriman_id:
                errors.append(
                    f"Barcode {item.barcode} bukan dari pengiriman ID {payload.pengiriman_id}"
                )
                continue
            validated_items.append((item, unit))

        if errors:
            raise ValueError("Validasi gagal: " + " | ".join(errors))

        nomor_return = await self._generate_nomor_return()
        return_order = ReturnOrder(
            nomor_return=nomor_return,
            pengiriman_id=payload.pengiriman_id,
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

            # Update status unit sementara
            unit.returned_at = now
            if item_payload.kategori == KategoriReturn.RUSAK:
                unit.status = StatusUnit.RETURNED_DAMAGED
            else:
                unit.status = StatusUnit.RETURNED_GOOD

        await self.db.commit()
        await self.db.refresh(return_order)
        return return_order

    async def submit_return(self, return_id: int, driver_id: int) -> ReturnOrder:
        """Driver submit return order untuk direview gudang."""
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
        """
        Admin/Inventori review setiap item:
        - BAIK     → unit kembali ke READY (bisa dijual lagi)
        - RUSAK_KONFIRMASI → unit → VOID (kerugian tercatat)
        """
        ro = await self._get_or_404(return_id)
        if ro.status != StatusReturnOrder.SUBMITTED:
            raise ValueError("Return order harus berstatus SUBMITTED untuk direview")

        # Build lookup map item by id
        item_map = {item.id: item for item in ro.items}

        for review in payload.items:
            ret_item = item_map.get(review.return_item_id)
            if not ret_item:
                raise ValueError(f"Return item ID {review.return_item_id} tidak ditemukan")

            ret_item.kondisi_konfirmasi = review.kondisi_konfirmasi
            ret_item.catatan_reviewer = review.catatan_reviewer

            # Update production unit berdasarkan hasil konfirmasi
            result = await self.db.execute(
                select(ProductionUnit).where(
                    ProductionUnit.id == ret_item.production_unit_id
                )
            )
            unit = result.scalar_one_or_none()
            if not unit:
                continue

            if review.kondisi_konfirmasi == KondisiKonfirmasi.BAIK:
                # Kondisi baik: kembalikan ke READY, bisa dijual lagi
                unit.status = StatusUnit.READY
                unit.pengiriman_id = None  # lepas dari pengiriman lama
            elif review.kondisi_konfirmasi == KondisiKonfirmasi.RUSAK_KONFIRMASI:
                # Benar-benar rusak: VOID
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
        """Summary retur: berapa sisa, berapa rusak, berapa dikonfirmasi."""
        ro = await self._get_or_404(return_id)
        total_sisa = sum(1 for i in ro.items if i.kategori == KategoriReturn.SISA)
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

        # Group by batch (mo_id)
        batch_summary: dict[int, dict] = {}
        for item in ro.items:
            if item.mo_id not in batch_summary:
                batch_summary[item.mo_id] = {
                    "mo_id": item.mo_id,
                    "sisa": 0, "rusak": 0
                }
            if item.kategori == KategoriReturn.SISA:
                batch_summary[item.mo_id]["sisa"] += 1
            else:
                batch_summary[item.mo_id]["rusak"] += 1

        return {
            "nomor_return": ro.nomor_return,
            "status": ro.status,
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
