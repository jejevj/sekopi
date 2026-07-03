from datetime import date, datetime, timezone
from sqlalchemy import select, func, and_, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.gerobak import Gerobak, ShareholderGroup, GroupMembership
from app.models.production_unit import ProductionUnit, StatusUnit
from app.models.penjualan import Penjualan
from app.models.manufacturing_order import ManufacturingOrder
from app.models.return_order import ReturnItem, KondisiKonfirmasi
from app.models.user import User
from app.schemas.laporan import (
    BatchProduksiSummary,
    KerugianItem,
    LaporanKerugian,
    LaporanUmumResponse,
    LaporanShareholderResponse,
    PenjualanHarian,
    PenjualanPerGerobak,
)

DEFAULT_HARGA_SATUAN = 15000.0


class LaporanService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── helpers ──────────────────────────────────────────────────────────────

    async def _penjualan_harian(self, dari: date, sampai: date, gerobak_ids: list[int] | None = None):
        q = (
            select(
                func.date(Penjualan.sold_at).label("tanggal"),
                func.count(Penjualan.id).label("total_terjual"),
                func.sum(Penjualan.harga).label("total_pendapatan"),
            )
            .where(func.date(Penjualan.sold_at).between(dari, sampai))
        )
        if gerobak_ids is not None:
            q = q.where(Penjualan.gerobak_id.in_(gerobak_ids))
        q = q.group_by(func.date(Penjualan.sold_at)).order_by(func.date(Penjualan.sold_at))
        result = await self.db.execute(q)
        return result.all()

    async def _penjualan_per_gerobak(self, dari: date, sampai: date, gerobak_ids: list[int] | None = None):
        q = (
            select(
                Penjualan.gerobak_id,
                func.count(Penjualan.id).label("total_terjual"),
                func.sum(Penjualan.harga).label("total_pendapatan"),
            )
            .where(
                func.date(Penjualan.sold_at).between(dari, sampai),
                Penjualan.gerobak_id.isnot(None),
            )
        )
        if gerobak_ids is not None:
            q = q.where(Penjualan.gerobak_id.in_(gerobak_ids))
        q = q.group_by(Penjualan.gerobak_id)
        result = await self.db.execute(q)
        return result.all()

    async def _build_kerugian(
        self, dari: date, sampai: date, gerobak_ids: list[int] | None = None
    ) -> tuple[int, int, int, float, list[KerugianItem]]:
        """Returns (expired, rusak, void, avg_modal, kerugian_items)"""
        def _where(q, extra=None):
            conds = [func.date(ProductionUnit.created_at).between(dari, sampai)]
            if gerobak_ids is not None:
                subq = select(Penjualan.production_unit_id).where(
                    Penjualan.gerobak_id.in_(gerobak_ids)
                )
                conds.append(ProductionUnit.id.in_(subq))
            if extra:
                conds.append(extra)
            return q.where(and_(*conds))

        r = await self.db.execute(_where(
            select(func.count(ProductionUnit.id)),
            ProductionUnit.status == StatusUnit.EXPIRED,
        ))
        total_expired = r.scalar() or 0

        r = await self.db.execute(_where(
            select(func.count(ProductionUnit.id)),
            ProductionUnit.status == StatusUnit.VOID,
        ))
        total_void = r.scalar() or 0

        r = await self.db.execute(
            select(func.count(ReturnItem.id)).where(
                ReturnItem.kondisi_konfirmasi == KondisiKonfirmasi.RUSAK_KONFIRMASI
            )
        )
        total_rusak = r.scalar() or 0

        r = await self.db.execute(_where(
            select(func.avg(ProductionUnit.harga_modal)).where(
                ProductionUnit.harga_modal.isnot(None)
            )
        ))
        avg_modal = r.scalar()
        if not avg_modal:
            r = await self.db.execute(
                select(func.avg(Penjualan.harga)).where(
                    func.date(Penjualan.sold_at).between(dari, sampai)
                )
            )
            avg_modal = r.scalar() or DEFAULT_HARGA_SATUAN
        avg_modal = float(avg_modal)

        estimasi = (total_expired + total_rusak + total_void) * avg_modal
        items = [
            KerugianItem(kategori="EXPIRED", jumlah_unit=total_expired,
                         estimasi_kerugian=round(total_expired * avg_modal, 2),
                         keterangan="Unit melewati expiry date sebelum terjual"),
            KerugianItem(kategori="RUSAK_KONFIRMASI", jumlah_unit=total_rusak,
                         estimasi_kerugian=round(total_rusak * avg_modal, 2),
                         keterangan="Unit dikonfirmasi rusak saat retur driver"),
            KerugianItem(kategori="VOID_LAINNYA", jumlah_unit=max(0, total_void - total_rusak),
                         estimasi_kerugian=round(max(0, total_void - total_rusak) * avg_modal, 2),
                         keterangan="Unit di-void karena sebab lain"),
        ]
        return total_expired, total_rusak, total_void, estimasi, items

    async def _by_batch(
        self, dari: date, sampai: date, gerobak_ids: list[int] | None = None
    ) -> list[BatchProduksiSummary]:
        result = await self.db.execute(
            select(ManufacturingOrder)
            .where(func.date(ManufacturingOrder.created_at).between(dari, sampai))
            .order_by(ManufacturingOrder.id)
        )
        mos = result.scalars().all()
        batches = []
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
            batches.append(BatchProduksiSummary(
                mo_id=mo.id, nomor_mo=mo.nomor_mo, nama_produk=mo.nama_produk,
                total_diproduksi=total, total_terjual=terjual,
                total_sisa_kembali=row.sisa or 0, total_rusak=row.rusak or 0,
                total_expired=row.expired or 0,
                persentase_terjual=round((terjual / total * 100) if total > 0 else 0, 2),
            ))
        return batches

    async def _gerobak_info(self, gerobak_ids: list[int]) -> dict[int, Gerobak]:
        result = await self.db.execute(
            select(Gerobak).where(Gerobak.id.in_(gerobak_ids))
        )
        return {g.id: g for g in result.scalars().all()}

    # ── Laporan Umum (ADMIN) ─────────────────────────────────────────────────

    async def get_laporan_umum(self, dari: date, sampai: date) -> LaporanUmumResponse:
        now = datetime.now(timezone.utc)

        r = await self.db.execute(
            select(func.count(ProductionUnit.id)).where(
                func.date(ProductionUnit.created_at).between(dari, sampai)
            )
        )
        total_diproduksi = r.scalar() or 0

        rows_harian = await self._penjualan_harian(dari, sampai)
        penjualan_harian = [
            PenjualanHarian(tanggal=r.tanggal, total_terjual=r.total_terjual,
                            total_pendapatan=float(r.total_pendapatan))
            for r in rows_harian
        ]
        total_terjual = sum(p.total_terjual for p in penjualan_harian)
        total_pendapatan = sum(p.total_pendapatan for p in penjualan_harian)
        jumlah_hari = max((sampai - dari).days + 1, 1)

        rows_gerobak = await self._penjualan_per_gerobak(dari, sampai)
        gerobak_map = await self._gerobak_info([r.gerobak_id for r in rows_gerobak if r.gerobak_id])
        penjualan_per_gerobak = [
            PenjualanPerGerobak(
                gerobak_id=r.gerobak_id,
                gerobak_nama=gerobak_map.get(r.gerobak_id, Gerobak()).nama or "-",
                gerobak_kode=gerobak_map.get(r.gerobak_id, Gerobak()).kode or "-",
                total_terjual=r.total_terjual,
                total_pendapatan=float(r.total_pendapatan),
                persentase_dari_total=round(
                    (float(r.total_pendapatan) / total_pendapatan * 100) if total_pendapatan > 0 else 0, 2
                ),
            ) for r in rows_gerobak if r.gerobak_id
        ]

        expired, rusak, void, estimasi, kerugian_items = await self._build_kerugian(dari, sampai)
        by_batch = await self._by_batch(dari, sampai)

        pct_terjual = round((total_terjual / total_diproduksi * 100) if total_diproduksi > 0 else 0, 2)
        pct_kerugian = round(((expired + rusak + void) / total_diproduksi * 100) if total_diproduksi > 0 else 0, 2)

        return LaporanUmumResponse(
            periode_dari=dari, periode_sampai=sampai, generated_at=now,
            total_unit_diproduksi=total_diproduksi, total_unit_terjual=total_terjual,
            total_pendapatan=total_pendapatan,
            rata_rata_pendapatan_harian=round(total_pendapatan / jumlah_hari, 2),
            total_unit_expired=expired, total_unit_rusak=rusak, total_unit_void=void,
            estimasi_kerugian=round(estimasi, 2),
            persentase_terjual=pct_terjual, persentase_kerugian=pct_kerugian,
            penjualan_harian=penjualan_harian,
            penjualan_per_gerobak=penjualan_per_gerobak,
            kerugian_detail=LaporanKerugian(
                periode_dari=dari, periode_sampai=sampai,
                total_unit_expired=expired, total_unit_rusak_konfirmasi=rusak,
                total_unit_void_lainnya=max(0, void - rusak),
                total_unit_kerugian=expired + rusak + void,
                estimasi_total_kerugian=round(estimasi, 2),
                detail=kerugian_items, by_batch=[b.model_dump() for b in by_batch],
            ),
            by_batch=by_batch,
        )

    # ── Laporan Shareholder (filter by grup) ─────────────────────────────────

    async def get_laporan_shareholder(
        self, dari: date, sampai: date,
        user_id: int | None = None,
        group_id: int | None = None,
    ) -> LaporanShareholderResponse:
        now = datetime.now(timezone.utc)

        aktif_group: ShareholderGroup | None = None
        gerobak_ids: list[int] = []
        gerobak_names: list[str] = []

        if group_id:
            aktif_group = await self.db.get(ShareholderGroup, group_id)
        elif user_id:
            # Cari grup pertama yang user ini terdaftar sebagai member
            # Pakai GroupMembership ORM class (pengganti shareholder_group_members Table)
            r = await self.db.execute(
                select(ShareholderGroup)
                .join(GroupMembership, ShareholderGroup.id == GroupMembership.group_id)
                .where(GroupMembership.user_id == user_id)
                .limit(1)
            )
            aktif_group = r.scalar_one_or_none()

        if aktif_group:
            r = await self.db.execute(
                select(Gerobak).where(
                    Gerobak.shareholder_group_id == aktif_group.id,
                    Gerobak.is_active == True,
                )
            )
            gerobaks = r.scalars().all()
            gerobak_ids = [g.id for g in gerobaks]
            gerobak_names = [g.nama for g in gerobaks]

        filter_ids = gerobak_ids if gerobak_ids else None

        r = await self.db.execute(
            select(func.count(ProductionUnit.id)).where(
                func.date(ProductionUnit.created_at).between(dari, sampai)
            )
        )
        total_diproduksi = r.scalar() or 0

        rows_harian = await self._penjualan_harian(dari, sampai, filter_ids)
        penjualan_harian = [
            PenjualanHarian(tanggal=r.tanggal, total_terjual=r.total_terjual,
                            total_pendapatan=float(r.total_pendapatan))
            for r in rows_harian
        ]
        total_terjual = sum(p.total_terjual for p in penjualan_harian)
        total_pendapatan = sum(p.total_pendapatan for p in penjualan_harian)
        jumlah_hari = max((sampai - dari).days + 1, 1)

        rows_gerobak = await self._penjualan_per_gerobak(dari, sampai, filter_ids)
        gerobak_map = await self._gerobak_info([r.gerobak_id for r in rows_gerobak if r.gerobak_id])
        penjualan_per_gerobak = [
            PenjualanPerGerobak(
                gerobak_id=r.gerobak_id,
                gerobak_nama=gerobak_map.get(r.gerobak_id, Gerobak()).nama or "-",
                gerobak_kode=gerobak_map.get(r.gerobak_id, Gerobak()).kode or "-",
                total_terjual=r.total_terjual,
                total_pendapatan=float(r.total_pendapatan),
                persentase_dari_total=round(
                    (float(r.total_pendapatan) / total_pendapatan * 100) if total_pendapatan > 0 else 0, 2
                ),
            ) for r in rows_gerobak if r.gerobak_id
        ]

        expired, rusak, void, estimasi, kerugian_items = await self._build_kerugian(dari, sampai, filter_ids)
        by_batch = await self._by_batch(dari, sampai)

        pct_terjual = round((total_terjual / total_diproduksi * 100) if total_diproduksi > 0 else 0, 2)
        pct_kerugian = round(((expired + rusak + void) / total_diproduksi * 100) if total_diproduksi > 0 else 0, 2)

        return LaporanShareholderResponse(
            periode_dari=dari, periode_sampai=sampai, generated_at=now,
            shareholder_group_id=aktif_group.id if aktif_group else None,
            shareholder_group_nama=aktif_group.nama if aktif_group else None,
            gerobaks=gerobak_names,
            total_unit_diproduksi=total_diproduksi, total_unit_terjual=total_terjual,
            total_pendapatan=total_pendapatan,
            rata_rata_pendapatan_harian=round(total_pendapatan / jumlah_hari, 2),
            total_unit_expired=expired, total_unit_rusak=rusak, total_unit_void=void,
            estimasi_kerugian=round(estimasi, 2),
            persentase_terjual=pct_terjual, persentase_kerugian=pct_kerugian,
            penjualan_harian=penjualan_harian,
            penjualan_per_gerobak=penjualan_per_gerobak,
            kerugian_detail=LaporanKerugian(
                periode_dari=dari, periode_sampai=sampai,
                total_unit_expired=expired, total_unit_rusak_konfirmasi=rusak,
                total_unit_void_lainnya=max(0, void - rusak),
                total_unit_kerugian=expired + rusak + void,
                estimasi_total_kerugian=round(estimasi, 2),
                detail=kerugian_items, by_batch=[b.model_dump() for b in by_batch],
            ),
            by_batch=by_batch,
        )
