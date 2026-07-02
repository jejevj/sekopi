from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundException
from app.models.production_unit import ProductionUnit, StatusUnit
from app.models.penjualan import Penjualan
from app.models.manufacturing_order import ManufacturingOrder, StatusMO
from app.repositories.production_unit_repo import ProductionUnitRepository
from app.schemas.production_unit import (
    ScanDispatchRequest,
    ScanDeliverRequest,
    ScanSellRequest,
    ScanVoidRequest,
    ScanResultResponse,
)


class ProductionUnitService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = ProductionUnitRepository(db)

    async def generate_units(self, mo_id: int, jumlah: int, user_id: int) -> list[ProductionUnit]:
        """Generate barcode units setelah MO selesai (status DONE)."""
        from sqlalchemy import select
        result = await self.db.execute(
            select(ManufacturingOrder).where(ManufacturingOrder.id == mo_id)
        )
        mo = result.scalar_one_or_none()
        if not mo:
            raise NotFoundException(f"MO ID {mo_id} tidak ditemukan")
        if mo.status != StatusMO.DONE:
            raise ValueError("Unit hanya bisa di-generate jika MO sudah berstatus DONE")

        units = []
        for _ in range(jumlah):
            barcode = await self.repo.generate_barcode()
            unit = ProductionUnit(
                barcode=barcode,
                mo_id=mo_id,
                nama_produk=mo.nama_produk,
                status=StatusUnit.READY,
            )
            self.db.add(unit)
            await self.db.flush()  # get id tanpa commit agar barcode increment benar
            units.append(unit)

        await self.db.commit()
        for unit in units:
            await self.db.refresh(unit)
        return units

    async def scan_dispatch(self, payload: ScanDispatchRequest, user_id: int) -> list[ScanResultResponse]:
        """Driver scan barcode saat loading ke kendaraan."""
        results = []
        now = datetime.now(timezone.utc)
        for barcode in payload.barcodes:
            unit = await self.repo.get_by_barcode(barcode)
            if not unit:
                results.append(ScanResultResponse(barcode=barcode, status="error", message="Barcode tidak ditemukan"))
                continue
            if unit.status != StatusUnit.READY:
                results.append(ScanResultResponse(barcode=barcode, status="error", message=f"Unit tidak dalam status READY (saat ini: {unit.status})", unit=unit))
                continue
            unit.status = StatusUnit.DISPATCHED
            unit.pengiriman_id = payload.pengiriman_id
            unit.dispatched_at = now
            results.append(ScanResultResponse(barcode=barcode, status="ok", message="Berhasil di-dispatch", unit=unit))

        await self.db.commit()
        return results

    async def scan_deliver(self, payload: ScanDeliverRequest, user_id: int) -> list[ScanResultResponse]:
        """Gerobak/Driver scan barcode saat konfirmasi terima."""
        results = []
        now = datetime.now(timezone.utc)
        for barcode in payload.barcodes:
            unit = await self.repo.get_by_barcode(barcode)
            if not unit:
                results.append(ScanResultResponse(barcode=barcode, status="error", message="Barcode tidak ditemukan"))
                continue
            if unit.status != StatusUnit.DISPATCHED:
                results.append(ScanResultResponse(barcode=barcode, status="error", message=f"Unit belum di-dispatch (saat ini: {unit.status})", unit=unit))
                continue
            unit.status = StatusUnit.DELIVERED
            unit.delivered_at = now
            results.append(ScanResultResponse(barcode=barcode, status="ok", message="Berhasil dikonfirmasi terima", unit=unit))

        await self.db.commit()
        return results

    async def scan_sell(self, payload: ScanSellRequest, kasir_id: int) -> ScanResultResponse:
        """Kasir scan barcode saat penjualan."""
        unit = await self.repo.get_by_barcode(payload.barcode)
        if not unit:
            return ScanResultResponse(barcode=payload.barcode, status="error", message="Barcode tidak ditemukan")
        if unit.status != StatusUnit.DELIVERED:
            return ScanResultResponse(
                barcode=payload.barcode,
                status="error",
                message=f"Unit tidak bisa dijual (status: {unit.status})",
                unit=unit,
            )

        now = datetime.now(timezone.utc)
        unit.status = StatusUnit.SOLD
        unit.sold_at = now

        penjualan = Penjualan(
            production_unit_id=unit.id,
            barcode=unit.barcode,
            nama_produk=unit.nama_produk,
            harga=payload.harga,
            catatan=payload.catatan,
            kasir_id=kasir_id,
            sold_at=now,
        )
        self.db.add(penjualan)
        await self.db.commit()
        await self.db.refresh(unit)
        return ScanResultResponse(barcode=payload.barcode, status="ok", message="Terjual!", unit=unit)

    async def scan_void(self, payload: ScanVoidRequest, user_id: int) -> ScanResultResponse:
        """Void unit yang rusak atau salah."""
        unit = await self.repo.get_by_barcode(payload.barcode)
        if not unit:
            return ScanResultResponse(barcode=payload.barcode, status="error", message="Barcode tidak ditemukan")
        if unit.status == StatusUnit.SOLD:
            return ScanResultResponse(barcode=payload.barcode, status="error", message="Unit yang sudah terjual tidak bisa di-void", unit=unit)

        unit.status = StatusUnit.VOID
        unit.voided_at = datetime.now(timezone.utc)
        unit.void_reason = payload.alasan
        await self.db.commit()
        await self.db.refresh(unit)
        return ScanResultResponse(barcode=payload.barcode, status="ok", message="Unit berhasil di-void", unit=unit)
