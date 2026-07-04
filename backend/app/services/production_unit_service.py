from datetime import datetime, date, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundException
from app.models.production_unit import ProductionUnit, GenerateBatch, StatusUnit
from app.models.penjualan import Penjualan
from app.models.manufacturing_order import ManufacturingOrder, MOLine, StatusMO
from app.repositories.production_unit_repo import ProductionUnitRepository
from app.schemas.production_unit import (
    ExpiryAlertResponse,
    GenerateBatchResponse,
    GenerateUnitsResponse,
    PaginatedUnitResponse,
    ProductionUnitResponse,
    ScanDispatchRequest,
    ScanDeliverRequest,
    ScanSellRequest,
    ScanVoidRequest,
    ScanResultResponse,
)

EXPIRY_WARNING_DAYS = 2


def _enrich_unit(unit: ProductionUnit) -> ProductionUnitResponse:
    today = date.today()
    hari_tersisa = (unit.expiry_date - today).days
    resp = ProductionUnitResponse.model_validate(unit)
    resp.hari_tersisa = hari_tersisa
    resp.is_expired = hari_tersisa < 0
    resp.is_expiring_soon = 0 <= hari_tersisa <= EXPIRY_WARNING_DAYS
    return resp


class ProductionUnitService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = ProductionUnitRepository(db)

    async def generate_units_with_batch(
        self,
        mo_id: int,
        mo_line_id: int,
        jumlah: int,
        expiry_date: date,
        harga_modal: float | None,
        user_id: int,
        alasan_selisih: str | None = None,
        kategori_selisih=None,
    ) -> GenerateUnitsResponse:
        # Validasi MO
        mo_result = await self.db.execute(
            select(ManufacturingOrder).where(ManufacturingOrder.id == mo_id)
        )
        mo = mo_result.scalar_one_or_none()
        if not mo:
            raise NotFoundException(f"MO ID {mo_id} tidak ditemukan")
        if mo.status != StatusMO.DONE:
            raise ValueError("Unit hanya bisa di-generate jika MO sudah berstatus DONE")

        # Validasi MOLine
        line_result = await self.db.execute(
            select(MOLine).where(MOLine.id == mo_line_id, MOLine.mo_id == mo_id)
        )
        line = line_result.scalar_one_or_none()
        if not line:
            raise NotFoundException(f"MOLine ID {mo_line_id} tidak ditemukan di MO {mo_id}")

        jumlah_target = int(line.target_qty)
        selisih = jumlah_target - jumlah

        if selisih != 0 and not alasan_selisih:
            raise ValueError(
                f"Jumlah aktual ({jumlah}) berbeda dari target ({jumlah_target}). "
                "Wajib isi alasan_selisih."
            )

        # Buat GenerateBatch
        batch = GenerateBatch(
            mo_id=mo_id,
            mo_line_id=mo_line_id,
            generated_by=user_id,
            jumlah_target=jumlah_target,
            jumlah_aktual=jumlah,
            selisih_qty=selisih,
            alasan_selisih=alasan_selisih,
            kategori_selisih=kategori_selisih,
            expiry_date=expiry_date,
            harga_modal=harga_modal,
            harga_jual=line.menu.harga_jual if line.menu else None,
        )
        self.db.add(batch)
        await self.db.flush()

        # Generate ProductionUnit
        units = []
        for _ in range(jumlah):
            barcode = await self.repo.generate_barcode()
            unit = ProductionUnit(
                barcode=barcode,
                mo_id=mo_id,
                mo_line_id=mo_line_id,
                nama_produk=line.nama_produk,
                expiry_date=expiry_date,
                harga_modal=harga_modal,
                status=StatusUnit.READY,
            )
            self.db.add(unit)
            await self.db.flush()
            units.append(unit)

        await self.db.commit()
        for unit in units:
            await self.db.refresh(unit)
        await self.db.refresh(batch)

        peringatan = None
        if selisih != 0:
            peringatan = (
                f"Selisih {abs(selisih)} unit "
                f"({'kurang' if selisih > 0 else 'lebih'} dari target {jumlah_target}). "
                f"Alasan: {alasan_selisih}"
            )

        return GenerateUnitsResponse(
            batch=GenerateBatchResponse.model_validate(batch),
            units=[_enrich_unit(u) for u in units],
            peringatan_selisih=peringatan,
        )

    async def get_by_mo_paginated(
        self, mo_id: int, page: int = 1, per_page: int = 50
    ) -> PaginatedUnitResponse:
        items, total = await self.repo.get_by_mo(mo_id, page, per_page)
        return PaginatedUnitResponse(
            total=total,
            page=page,
            per_page=per_page,
            total_pages=-(-total // per_page),
            items=[_enrich_unit(u) for u in items],
        )

    async def get_ready_fefo_paginated(
        self, page: int = 1, per_page: int = 50
    ) -> PaginatedUnitResponse:
        items, total = await self.repo.get_ready_fefo(page, per_page)
        return PaginatedUnitResponse(
            total=total,
            page=page,
            per_page=per_page,
            total_pages=-(-total // per_page),
            items=[_enrich_unit(u) for u in items],
        )

    async def scan_dispatch(
        self, payload: ScanDispatchRequest, user_id: int
    ) -> list[ScanResultResponse]:
        results = []
        now = datetime.now(timezone.utc)
        today = date.today()
        for barcode in payload.barcodes:
            unit = await self.repo.get_by_barcode(barcode)
            if not unit:
                results.append(ScanResultResponse(barcode=barcode, status="error", message="Barcode tidak ditemukan"))
                continue
            if unit.expiry_date <= today:
                results.append(ScanResultResponse(barcode=barcode, status="error", message=f"Unit sudah EXPIRED ({unit.expiry_date}), tidak bisa di-dispatch", unit=_enrich_unit(unit)))
                continue
            if unit.status != StatusUnit.READY:
                results.append(ScanResultResponse(barcode=barcode, status="error", message=f"Status unit bukan READY (saat ini: {unit.status})", unit=_enrich_unit(unit)))
                continue
            unit.status = StatusUnit.DISPATCHED
            unit.pengiriman_id = payload.pengiriman_id
            unit.dispatched_at = now
            hari = (unit.expiry_date - today).days
            msg = "Berhasil di-dispatch"
            if hari <= EXPIRY_WARNING_DAYS:
                msg += f" ⚠️ Expiry {hari} hari lagi ({unit.expiry_date}), prioritaskan penjualan!"
            results.append(ScanResultResponse(barcode=barcode, status="ok", message=msg, unit=_enrich_unit(unit)))
        await self.db.commit()
        return results

    async def scan_deliver(
        self, payload: ScanDeliverRequest, user_id: int
    ) -> list[ScanResultResponse]:
        results = []
        now = datetime.now(timezone.utc)
        today = date.today()
        for barcode in payload.barcodes:
            unit = await self.repo.get_by_barcode(barcode)
            if not unit:
                results.append(ScanResultResponse(barcode=barcode, status="error", message="Barcode tidak ditemukan"))
                continue
            if unit.expiry_date <= today:
                results.append(ScanResultResponse(barcode=barcode, status="error", message=f"Unit sudah EXPIRED ({unit.expiry_date})", unit=_enrich_unit(unit)))
                continue
            if unit.status != StatusUnit.DISPATCHED:
                results.append(ScanResultResponse(barcode=barcode, status="error", message=f"Unit belum di-dispatch (saat ini: {unit.status})", unit=_enrich_unit(unit)))
                continue
            unit.status = StatusUnit.DELIVERED
            unit.delivered_at = now
            hari = (unit.expiry_date - today).days
            msg = "Berhasil dikonfirmasi terima"
            if hari <= EXPIRY_WARNING_DAYS:
                msg += f" ⚠️ Expiry {hari} hari lagi, jual segera!"
            results.append(ScanResultResponse(barcode=barcode, status="ok", message=msg, unit=_enrich_unit(unit)))
        await self.db.commit()
        return results

    async def scan_sell(
        self, payload: ScanSellRequest, kasir_id: int
    ) -> ScanResultResponse:
        unit = await self.repo.get_by_barcode(payload.barcode)
        if not unit:
            return ScanResultResponse(barcode=payload.barcode, status="error", message="Barcode tidak ditemukan")
        today = date.today()
        if unit.expiry_date < today:
            return ScanResultResponse(
                barcode=payload.barcode, status="error",
                message=f"Produk sudah EXPIRED sejak {unit.expiry_date}, tidak bisa dijual!",
                unit=_enrich_unit(unit),
            )
        if unit.status != StatusUnit.DELIVERED:
            return ScanResultResponse(
                barcode=payload.barcode, status="error",
                message=f"Unit tidak bisa dijual (status: {unit.status})",
                unit=_enrich_unit(unit),
            )
        now = datetime.now(timezone.utc)
        unit.status = StatusUnit.SOLD
        unit.sold_at = now
        penjualan = Penjualan(
            production_unit_id=unit.id,
            barcode=unit.barcode,
            nama_produk=unit.nama_produk,
            harga=payload.harga if hasattr(payload, 'harga') else None,
            catatan=payload.catatan if hasattr(payload, 'catatan') else None,
            kasir_id=kasir_id,
            sold_at=now,
        )
        self.db.add(penjualan)
        await self.db.commit()
        await self.db.refresh(unit)
        return ScanResultResponse(barcode=payload.barcode, status="ok", message="Terjual! ☕", unit=_enrich_unit(unit))

    async def scan_void(
        self, payload: ScanVoidRequest, user_id: int
    ) -> ScanResultResponse:
        unit = await self.repo.get_by_barcode(payload.barcode)
        if not unit:
            return ScanResultResponse(barcode=payload.barcode, status="error", message="Barcode tidak ditemukan")
        if unit.status == StatusUnit.SOLD:
            return ScanResultResponse(barcode=payload.barcode, status="error", message="Unit yang sudah terjual tidak bisa di-void", unit=_enrich_unit(unit))
        unit.status = StatusUnit.VOID
        unit.voided_at = datetime.now(timezone.utc)
        unit.void_reason = payload.alasan
        await self.db.commit()
        await self.db.refresh(unit)
        return ScanResultResponse(barcode=payload.barcode, status="ok", message="Unit berhasil di-void", unit=_enrich_unit(unit))

    async def get_expiry_alerts(self, days: int = EXPIRY_WARNING_DAYS) -> ExpiryAlertResponse:
        expiring = await self.repo.get_expiring_soon(days)
        expired = await self.repo.get_expired_unsold()
        return ExpiryAlertResponse(
            total_akan_expired=len(expiring),
            total_sudah_expired=len(expired),
            units_expiring_soon=[_enrich_unit(u) for u in expiring],
            units_expired=[_enrich_unit(u) for u in expired],
        )

    async def trigger_mark_expired(self) -> dict:
        count = await self.repo.mark_expired_units()
        return {"marked_expired": count, "message": f"{count} unit ditandai sebagai EXPIRED"}
