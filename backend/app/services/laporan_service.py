from datetime import date, datetime, timezone, timedelta
from sqlalchemy import select, func, and_, case, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.production_unit import ProductionUnit, StatusUnit
from app.models.penjualan import Penjualan
from app.models.manufacturing_order import ManufacturingOrder
from app.models.return_order import ReturnItem, KondisiKonfirmasi
from app.schemas.laporan import (
    BatchProduksiSummary,
    KerugianItem,
    LaporanKerugian,
    LaporanShareholderResponse,
    PenjualanHarian,
)

DEFAULT_HARGA_SATUAN = 15000.0


class LaporanService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_laporan_shareholder(
        self, dari: date, sampai: date
    ) -> LaporanShareholderResponse:
        now = datetime.now(timezone.utc)

        # 1. Total diproduksi
        result = await self.db.execute(
            select(func.count(ProductionUnit.id)).where(
                func.date(ProductionUnit.created_at).between(dari, sampai)
            )
        )
        total_diproduksi = result.scalar() or 0

        # 2. Penjualan harian
        result = await self.db.execute(
            select(
                func.date(Penjualan.sold_at).label("tanggal"),
                func.count(Penjualan.id).label("total_terjual"),
                func.sum(Penjualan.harga).label("total_pendapatan"),
            )
            .where(func.date(Penjualan.sold_at).between(dari, sampai))
            .group_by(func.date(Penjualan.sold_at))
            .order_by(func.date(Penjualan.sold_at))
        )
        rows = result.all()
        penjualan_harian = [
            PenjualanHarian(
                tanggal=r.tanggal,
                total_terjual=r.total_terjual,
                total_pendapatan=float(r.total_pendapatan),
            ) for r in rows
        ]
        total_terjual = sum(p.total_terjual for p in penjualan_harian)
        total_pendapatan = sum(p.total_pendapatan for p in penjualan_harian)
        jumlah_hari = max((sampai - dari).days + 1, 1)
        rata_harian = total_pendapatan / jumlah_hari

        # 3. Expired
        result = await self.db.execute(
            select(func.count(ProductionUnit.id)).where(
                and_(
                    ProductionUnit.status == StatusUnit.EXPIRED,
                    func.date(ProductionUnit.created_at).between(dari, sampai),
                )
            )
        )
        total_expired = result.scalar() or 0

        # 4. Void
        result = await self.db.execute(
            select(func.count(ProductionUnit.id)).where(
                and_(
                    ProductionUnit.status == StatusUnit.VOID,
                    func.date(ProductionUnit.created_at).between(dari, sampai),
                )
            )
        )
        total_void = result.scalar() or 0

        # 5. Rusak dikonfirmasi
        result = await self.db.execute(
            select(func.count(ReturnItem.id)).where(
                ReturnItem.kondisi_konfirmasi == KondisiKonfirmasi.RUSAK_KONFIRMASI
            )
        )
        total_rusak = result.scalar() or 0

        # 6. Harga modal rata-rata dari unit (lebih akurat dari harga jual)
        result = await self.db.execute(
            select(func.avg(ProductionUnit.harga_modal)).where(
                and_(
                    ProductionUnit.harga_modal.isnot(None),
                    func.date(ProductionUnit.created_at).between(dari, sampai),
                )
            )
        )
        avg_modal = result.scalar()

        # Fallback: avg harga jual jika harga_modal belum diisi
        if not avg_modal:
            result = await self.db.execute(
                select(func.avg(Penjualan.harga)).where(
                    func.date(Penjualan.sold_at).between(dari, sampai)
                )
            )
            avg_modal = result.scalar() or DEFAULT_HARGA_SATUAN

        avg_modal = float(avg_modal)
        estimasi_kerugian = (total_expired + total_rusak + total_void) * avg_modal

        # 7. Kerugian detail
        kerugian_detail_list = [
            KerugianItem(
                kategori="EXPIRED",
                jumlah_unit=total_expired,
                estimasi_kerugian=round(total_expired * avg_modal, 2),
                keterangan="Unit melewati expiry date sebelum terjual",
            ),
            KerugianItem(
                kategori="RUSAK_KONFIRMASI",
                jumlah_unit=total_rusak,
                estimasi_kerugian=round(total_rusak * avg_modal, 2),
                keterangan="Unit dikonfirmasi rusak saat retur driver",
            ),
            KerugianItem(
                kategori="VOID_LAINNYA",
                jumlah_unit=max(0, total_void - total_rusak),
                estimasi_kerugian=round(max(0, total_void - total_rusak) * avg_modal, 2),
                keterangan="Unit di-void karena sebab lain",
            ),
        ]

        # 8. Per batch
        result = await self.db.execute(
            select(ManufacturingOrder).where(
                func.date(ManufacturingOrder.created_at).between(dari, sampai)
            ).order_by(ManufacturingOrder.id)
        )
        mos = result.scalars().all()
        by_batch = []
        for mo in mos:
            r = await self.db.execute(
                select(
                    func.count(ProductionUnit.id).label("total"),
                    func.sum(case((ProductionUnit.status == StatusUnit.SOLD, 1), else_=0)).label("terjual"),
                    func.sum(case((ProductionUnit.status == StatusUnit.RETURNED_GOOD, 1), else_=0)).label("sisa"),
                    func.sum(case((ProductionUnit.status == StatusUnit.VOID, 1), else_=0)).label("rusak"),
                    func.sum(case((ProductionUnit.status == StatusUnit.EXPIRED, 1), else_=0)).label("expired"),
                ).where(ProductionUnit.mo_id == mo.id)
            )
            row = r.one()
            total = row.total or 0
            terjual = row.terjual or 0
            by_batch.append(
                BatchProduksiSummary(
                    mo_id=mo.id,
                    nomor_mo=mo.nomor_mo,
                    nama_produk=mo.nama_produk,
                    total_diproduksi=total,
                    total_terjual=terjual,
                    total_sisa_kembali=row.sisa or 0,
                    total_rusak=row.rusak or 0,
                    total_expired=row.expired or 0,
                    persentase_terjual=round((terjual / total * 100) if total > 0 else 0, 2),
                )
            )

        # 9. Efisiensi
        pct_terjual = round((total_terjual / total_diproduksi * 100) if total_diproduksi > 0 else 0, 2)
        pct_kerugian = round(
            ((total_expired + total_rusak + total_void) / total_diproduksi * 100)
            if total_diproduksi > 0 else 0, 2
        )

        return LaporanShareholderResponse(
            periode_dari=dari,
            periode_sampai=sampai,
            generated_at=now,
            total_unit_diproduksi=total_diproduksi,
            total_unit_terjual=total_terjual,
            total_pendapatan=total_pendapatan,
            rata_rata_pendapatan_harian=round(rata_harian, 2),
            total_unit_expired=total_expired,
            total_unit_rusak=total_rusak,
            total_unit_void=total_void,
            estimasi_kerugian=round(estimasi_kerugian, 2),
            persentase_terjual=pct_terjual,
            persentase_kerugian=pct_kerugian,
            penjualan_harian=penjualan_harian,
            kerugian_detail=LaporanKerugian(
                periode_dari=dari,
                periode_sampai=sampai,
                total_unit_expired=total_expired,
                total_unit_rusak_konfirmasi=total_rusak,
                total_unit_void_lainnya=max(0, total_void - total_rusak),
                total_unit_kerugian=total_expired + total_rusak + total_void,
                estimasi_total_kerugian=round(estimasi_kerugian, 2),
                detail=kerugian_detail_list,
                by_batch=[b.model_dump() for b in by_batch],
            ),
            by_batch=by_batch,
        )
