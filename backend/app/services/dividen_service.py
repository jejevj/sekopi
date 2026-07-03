from datetime import date, datetime, timezone
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.gerobak import ShareholderGroup
from app.models.penjualan import Penjualan
from app.models.purchase_order import PurchaseOrder, StatusPO
from app.models.dividen import GajiKaryawan, DividenDistribusi, StatusDividen
from app.schemas.dividen import (
    KalkulasiRequest, KalkulasiPreviewResponse, KalkulasiPerGrup,
    GajiCreate, GajiResponse, DividenResponse,
)


class DividenService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── helpers ──────────────────────────────────────────────────────────────

    async def _total_penjualan(self, dari: date, sampai: date) -> float:
        """Total revenue dari tabel penjualan berdasar sold_at."""
        result = await self.db.execute(
            select(func.coalesce(func.sum(Penjualan.harga), 0)).where(
                func.date(Penjualan.sold_at).between(dari, sampai)
            )
        )
        return float(result.scalar())

    async def _total_pembelian(self, dari: date, sampai: date) -> float:
        """Total PO berdasar tanggal_invoice (bukan tanggal_bayar)."""
        result = await self.db.execute(
            select(func.coalesce(func.sum(PurchaseOrder.total_amount), 0)).where(
                PurchaseOrder.tanggal_invoice.between(dari, sampai)
            )
        )
        return float(result.scalar())

    async def _all_groups(self) -> list[ShareholderGroup]:
        result = await self.db.execute(
            select(ShareholderGroup).order_by(ShareholderGroup.nama)
        )
        return result.scalars().all()

    # ── Preview kalkulasi (DRY-RUN, tidak simpan) ─────────────────────────────

    async def preview(self, req: KalkulasiRequest) -> KalkulasiPreviewResponse:
        groups = await self._all_groups()
        if not groups:
            raise ValueError("Belum ada shareholder group yang terdaftar")

        total_penjualan = await self._total_penjualan(req.periode_dari, req.periode_sampai)
        total_pembelian = await self._total_pembelian(req.periode_dari, req.periode_sampai)
        jumlah_grup     = len(groups)
        beban_per_grup  = round(req.total_gaji / jumlah_grup, 2)
        total_porsi     = round(sum(float(g.porsi_saham) for g in groups), 2)
        sisa_porsi      = round(100.0 - total_porsi, 2)

        per_grup = []
        for g in groups:
            porsi        = float(g.porsi_saham)
            laba_bersih  = round(total_penjualan - total_pembelian - beban_per_grup, 2)
            dividen      = round(laba_bersih * porsi / 100, 2)
            per_grup.append(KalkulasiPerGrup(
                group_id=g.id,
                group_nama=g.nama,
                porsi_saham=porsi,
                total_penjualan=round(total_penjualan, 2),
                total_pembelian=round(total_pembelian, 2),
                total_gaji_grup=beban_per_grup,
                laba_bersih_grup=laba_bersih,
                jumlah_dividen=dividen,
            ))

        return KalkulasiPreviewResponse(
            periode_label=req.periode_label,
            periode_dari=req.periode_dari,
            periode_sampai=req.periode_sampai,
            jumlah_grup=jumlah_grup,
            total_penjualan=round(total_penjualan, 2),
            total_pembelian=round(total_pembelian, 2),
            total_gaji=req.total_gaji,
            beban_gaji_per_grup=beban_per_grup,
            total_porsi_saham=total_porsi,
            sisa_porsi=sisa_porsi,
            per_grup=per_grup,
        )

    # ── Konfirmasi & simpan distribusi ───────────────────────────────────────

    async def konfirmasi(self, req: KalkulasiRequest, user_id: int) -> list[DividenResponse]:
        preview = await self.preview(req)

        # Simpan record gaji
        gaji = GajiKaryawan(
            periode_label=req.periode_label,
            periode_dari=req.periode_dari,
            periode_sampai=req.periode_sampai,
            total_gaji=req.total_gaji,
            catatan=req.catatan,
            dibuat_oleh=user_id,
        )
        self.db.add(gaji)

        # Simpan distribusi per grup
        records = []
        for item in preview.per_grup:
            rec = DividenDistribusi(
                group_id=item.group_id,
                periode_label=req.periode_label,
                periode_dari=req.periode_dari,
                periode_sampai=req.periode_sampai,
                total_penjualan=item.total_penjualan,
                total_pembelian=item.total_pembelian,
                total_gaji_grup=item.total_gaji_grup,
                laba_bersih_grup=item.laba_bersih_grup,
                porsi_saham=item.porsi_saham,
                jumlah_dividen=item.jumlah_dividen,
                status=StatusDividen.PENDING,
                catatan=req.catatan,
                dibuat_oleh=user_id,
            )
            self.db.add(rec)
            records.append(rec)

        await self.db.commit()
        for r in records:
            await self.db.refresh(r)

        return [self._to_response(r) for r in records]

    # ── Tandai dibayar ───────────────────────────────────────────────────────

    async def tandai_bayar(self, dividen_id: int, tanggal_bayar: date) -> DividenResponse:
        rec = await self.db.get(DividenDistribusi, dividen_id)
        if not rec:
            raise ValueError("Record dividen tidak ditemukan")
        rec.status        = StatusDividen.DIBAYAR
        rec.tanggal_bayar = tanggal_bayar
        await self.db.commit()
        await self.db.refresh(rec)
        return self._to_response(rec)

    # ── List ─────────────────────────────────────────────────────────────────

    async def list_dividen(
        self, group_id: int | None = None, status: StatusDividen | None = None
    ) -> list[DividenResponse]:
        q = select(DividenDistribusi).order_by(DividenDistribusi.periode_dari.desc())
        if group_id:
            q = q.where(DividenDistribusi.group_id == group_id)
        if status:
            q = q.where(DividenDistribusi.status == status)
        result = await self.db.execute(q)
        return [self._to_response(r) for r in result.scalars().all()]

    async def list_gaji(self) -> list:
        result = await self.db.execute(
            select(GajiKaryawan).order_by(GajiKaryawan.periode_dari.desc())
        )
        return result.scalars().all()

    # ── helper ───────────────────────────────────────────────────────────────

    def _to_response(self, r: DividenDistribusi) -> DividenResponse:
        return DividenResponse(
            id=r.id,
            group_id=r.group_id,
            group_nama=r.group.nama if r.group else "",
            periode_label=r.periode_label,
            periode_dari=r.periode_dari,
            periode_sampai=r.periode_sampai,
            total_penjualan=float(r.total_penjualan),
            total_pembelian=float(r.total_pembelian),
            total_gaji_grup=float(r.total_gaji_grup),
            laba_bersih_grup=float(r.laba_bersih_grup),
            porsi_saham=float(r.porsi_saham),
            jumlah_dividen=float(r.jumlah_dividen),
            status=r.status,
            tanggal_bayar=r.tanggal_bayar,
            catatan=r.catatan,
            created_at=r.created_at,
        )
