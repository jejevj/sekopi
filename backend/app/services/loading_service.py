"""
Loading Order Service

Lifecycle status unit:
  READY  →  ON_GEROBAK  (saat dispatch)
  ON_GEROBAK → SOLD          (saat penjualan dicatat)
  ON_GEROBAK → RETURNED_GOOD    (saat return review: baik)
  ON_GEROBAK → RETURNED_DAMAGED (saat return review: rusak)

Stok yang tampil di inventori hanya unit berstatus READY.
Unit ON_GEROBAK TIDAK mengurangi stok gudang — hanya menunjukkan sedang dibawa.
"""
from datetime import datetime, timezone
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.loading import LoadingOrder, LoadingItem, StatusLoading
from app.models.production_unit import ProductionUnit, StatusUnit
from app.models.user import UserRole


class LoadingService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── helpers ─────────────────────────────────────────────────────────────
    async def _get_loading(self, loading_id: int) -> LoadingOrder:
        result = await self.db.execute(
            select(LoadingOrder).where(LoadingOrder.id == loading_id)
        )
        lo = result.scalar_one_or_none()
        if not lo:
            raise ValueError(f"Loading order ID {loading_id} tidak ditemukan")
        return lo

    async def _get_unit_by_barcode(self, barcode: str) -> ProductionUnit:
        result = await self.db.execute(
            select(ProductionUnit).where(ProductionUnit.barcode == barcode)
        )
        unit = result.scalar_one_or_none()
        if not unit:
            raise ValueError(f"Barcode {barcode} tidak ditemukan")
        return unit

    async def _generate_nomor_loading(self) -> str:
        today = datetime.now(timezone.utc).strftime("%Y%m%d")
        prefix = f"LO-{today}-"
        result = await self.db.execute(
            select(func.count(LoadingOrder.id)).where(
                LoadingOrder.nomor_loading.like(f"{prefix}%")
            )
        )
        count = result.scalar() or 0
        return f"{prefix}{str(count + 1).zfill(3)}"

    # ── create draft ────────────────────────────────────────────────────────
    async def create_loading(
        self,
        gerobak_id: int,
        driver_id: int,
        dibuat_oleh: int,
        catatan: str | None,
        barcodes: list[str],
    ) -> LoadingOrder:
        nomor = await self._generate_nomor_loading()
        lo = LoadingOrder(
            nomor_loading=nomor,
            gerobak_id=gerobak_id,
            driver_id=driver_id,
            dibuat_oleh=dibuat_oleh,
            catatan=catatan,
            status=StatusLoading.DRAFT,
        )
        self.db.add(lo)
        await self.db.flush()

        for bc in barcodes:
            unit = await self._get_unit_by_barcode(bc)
            if unit.status != StatusUnit.READY:
                raise ValueError(
                    f"Barcode {bc} tidak bisa dimasukkan loading "
                    f"(status saat ini: {unit.status})"
                )
            item = LoadingItem(
                loading_order_id=lo.id,
                production_unit_id=unit.id,
                barcode_snapshot=unit.barcode,
                harga_modal_snapshot=unit.harga_modal or 0,
            )
            self.db.add(item)

        await self.db.commit()
        await self.db.refresh(lo)
        return lo

    # ── confirm ─────────────────────────────────────────────────────────────
    async def confirm_loading(self, loading_id: int, confirmed_by: int) -> LoadingOrder:
        lo = await self._get_loading(loading_id)
        if lo.status != StatusLoading.DRAFT:
            raise ValueError(f"Loading harus berstatus DRAFT untuk dikonfirmasi (saat ini: {lo.status})")
        lo.status = StatusLoading.CONFIRMED
        await self.db.commit()
        await self.db.refresh(lo)
        return lo

    # ── dispatch ─────────────────────────────────────────────────────────────
    async def dispatch_loading(self, loading_id: int, dispatched_by: int) -> LoadingOrder:
        """
        Ubah status loading → DISPATCHED dan update setiap unit:
          status       : READY → ON_GEROBAK
          loading_order_id, current_gerobak_id, current_driver_id  diisi
          dispatched_at diisi

        Stok gudang (READY) berkurang otomatis karena unit tidak lagi READY.
        """
        lo = await self._get_loading(loading_id)
        if lo.status not in (StatusLoading.DRAFT, StatusLoading.CONFIRMED):
            raise ValueError(
                f"Loading harus berstatus DRAFT/CONFIRMED untuk di-dispatch (saat ini: {lo.status})"
            )

        now = datetime.now(timezone.utc)
        for item in lo.items:
            result = await self.db.execute(
                select(ProductionUnit).where(ProductionUnit.id == item.production_unit_id)
            )
            unit = result.scalar_one_or_none()
            if not unit:
                continue
            if unit.status != StatusUnit.READY:
                raise ValueError(
                    f"Barcode {unit.barcode} tidak lagi berstatus READY "
                    f"(status: {unit.status}) — tidak bisa di-dispatch"
                )
            unit.status             = StatusUnit.ON_GEROBAK
            unit.loading_order_id   = lo.id
            unit.current_gerobak_id = lo.gerobak_id
            unit.current_driver_id  = lo.driver_id
            unit.dispatched_at      = now

        lo.status = StatusLoading.DISPATCHED
        await self.db.commit()
        await self.db.refresh(lo)
        return lo

    # ── get detail ───────────────────────────────────────────────────────────
    async def get_loading(self, loading_id: int) -> LoadingOrder:
        return await self._get_loading(loading_id)

    async def list_loadings(
        self, user_id: int, role: UserRole, page: int = 1, per_page: int = 20
    ) -> list[LoadingOrder]:
        q = select(LoadingOrder).order_by(LoadingOrder.created_at.desc())
        if role == UserRole.DRIVER:
            q = q.where(LoadingOrder.driver_id == user_id)
        q = q.offset((page - 1) * per_page).limit(per_page)
        result = await self.db.execute(q)
        return list(result.scalars().all())
