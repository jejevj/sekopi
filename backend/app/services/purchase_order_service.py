from datetime import date, datetime, timezone
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.purchase_order import PurchaseOrder, PurchaseOrderItem, StatusPO, MetodeBayar
from app.models.supplier import Supplier
from app.models.bahan_baku import BahanBaku
from app.models.stok import Stok, TipeTransaksiStok
from app.schemas.purchase_order import (
    POCreate, POUpdate, POResponse, POItemResponse,
    LaporanPengeluaranResponse, PengeluaranPerSupplier, PengeluaranPerBahan,
)


def _generate_nomor_po(seq: int) -> str:
    today = datetime.now(timezone.utc)
    return f"PO-{today.year}-{seq:04d}"


class PurchaseOrderService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _next_nomor_po(self) -> str:
        result = await self.db.execute(
            select(func.count(PurchaseOrder.id))
        )
        count = (result.scalar() or 0) + 1
        return _generate_nomor_po(count)

    def _build_item_response(self, item: PurchaseOrderItem) -> POItemResponse:
        return POItemResponse(
            id=item.id,
            bahan_baku_id=item.bahan_baku_id,
            bahan_baku_nama=item.bahan_baku.nama if item.bahan_baku else "",
            jumlah=float(item.jumlah),
            satuan=item.satuan,
            harga_satuan=float(item.harga_satuan),
            subtotal=float(item.subtotal),
        )

    def _po_to_response(self, po: PurchaseOrder) -> POResponse:
        data = POResponse.model_validate(po)
        data.items = [self._build_item_response(i) for i in po.items]
        return data

    async def _insert_stok_masuk(self, po: PurchaseOrder, user_id: int) -> None:
        """Insert satu baris Stok(tipe=MASUK) per item PO.
        Dipanggil hanya sekali saat PO pertama kali masuk status LUNAS atau DITERIMA.
        Idempotent: cek dulu apakah stok dari PO ini sudah pernah diinsert.
        """
        existing = await self.db.execute(
            select(Stok).where(Stok.keterangan == f"PO-{po.nomor_po}").limit(1)
        )
        if existing.scalar_one_or_none():
            return  # sudah pernah diinsert, skip

        for item in po.items:
            self.db.add(Stok(
                bahan_baku_id=item.bahan_baku_id,
                tipe=TipeTransaksiStok.MASUK,
                jumlah=float(item.jumlah),
                keterangan=f"PO-{po.nomor_po}",
                created_by=user_id,
            ))

    async def create_po(self, payload: POCreate, user_id: int) -> POResponse:
        nomor = await self._next_nomor_po()
        total = sum(i.jumlah * i.harga_satuan for i in payload.items)

        po = PurchaseOrder(
            nomor_po=nomor,
            supplier_id=payload.supplier_id,
            dibuat_oleh=user_id,
            tanggal_invoice=payload.tanggal_invoice,
            tanggal_jatuh_tempo=payload.tanggal_jatuh_tempo,
            metode_bayar=payload.metode_bayar,
            status=StatusPO.DRAFT,
            total_amount=total,
            catatan=payload.catatan,
        )
        self.db.add(po)
        await self.db.flush()

        for item in payload.items:
            self.db.add(PurchaseOrderItem(
                po_id=po.id,
                bahan_baku_id=item.bahan_baku_id,
                jumlah=item.jumlah,
                satuan=item.satuan,
                harga_satuan=item.harga_satuan,
                subtotal=round(item.jumlah * item.harga_satuan, 2),
            ))

        await self.db.commit()
        await self.db.refresh(po)
        return self._po_to_response(po)

    async def update_po(self, po_id: int, payload: POUpdate, user_id: int) -> POResponse:
        po = await self.db.get(PurchaseOrder, po_id)
        if not po:
            raise ValueError("PO tidak ditemukan")

        status_before = po.status

        for k, v in payload.model_dump(exclude_none=True).items():
            setattr(po, k, v)

        # Jika tanggal_bayar diisi dan status masih bukan LUNAS → otomatis LUNAS
        if payload.tanggal_bayar and po.status not in (StatusPO.LUNAS,):
            po.status = StatusPO.LUNAS

        status_after = po.status

        # Trigger stok MASUK saat pertama kali masuk LUNAS atau DITERIMA
        stok_trigger = {StatusPO.LUNAS, StatusPO.DITERIMA} if hasattr(StatusPO, 'DITERIMA') else {StatusPO.LUNAS}
        if status_before != status_after and status_after in stok_trigger:
            await self.db.flush()  # pastikan po.items sudah ter-load
            await self.db.refresh(po)
            await self._insert_stok_masuk(po, user_id)

        await self.db.commit()
        await self.db.refresh(po)
        return self._po_to_response(po)

    async def list_po(
        self, dari: date | None = None, sampai: date | None = None,
        status: StatusPO | None = None, supplier_id: int | None = None,
    ) -> list[POResponse]:
        q = select(PurchaseOrder)
        if dari:
            q = q.where(PurchaseOrder.tanggal_invoice >= dari)
        if sampai:
            q = q.where(PurchaseOrder.tanggal_invoice <= sampai)
        if status:
            q = q.where(PurchaseOrder.status == status)
        if supplier_id:
            q = q.where(PurchaseOrder.supplier_id == supplier_id)
        q = q.order_by(PurchaseOrder.tanggal_invoice.desc())
        result = await self.db.execute(q)
        return [self._po_to_response(po) for po in result.scalars().all()]

    async def get_laporan_pengeluaran(
        self, dari: date, sampai: date
    ) -> LaporanPengeluaranResponse:
        now = datetime.now(timezone.utc)
        today = datetime.now(timezone.utc).date()

        result = await self.db.execute(
            select(PurchaseOrder).where(
                PurchaseOrder.tanggal_invoice.between(dari, sampai)
            )
        )
        all_po = result.scalars().all()

        total_pengeluaran = sum(float(po.total_amount) for po in all_po)
        total_lunas = sum(float(po.total_amount) for po in all_po if po.status == StatusPO.LUNAS)
        total_outstanding = sum(float(po.total_amount) for po in all_po if po.status != StatusPO.LUNAS)
        total_jatuh_tempo = sum(
            float(po.total_amount) for po in all_po
            if po.status != StatusPO.LUNAS
            and po.tanggal_jatuh_tempo
            and po.tanggal_jatuh_tempo < today
        )

        po_outstanding = [
            self._po_to_response(po) for po in all_po
            if po.status not in (StatusPO.LUNAS,)
        ]

        supplier_map: dict[int, dict] = {}
        for po in all_po:
            sid = po.supplier_id
            if sid not in supplier_map:
                supplier_map[sid] = {
                    "supplier_id": sid,
                    "supplier_nama": po.supplier.nama if po.supplier else "-",
                    "jumlah_po": 0, "total_pengeluaran": 0.0,
                    "total_lunas": 0.0, "total_outstanding": 0.0,
                }
            supplier_map[sid]["jumlah_po"] += 1
            supplier_map[sid]["total_pengeluaran"] += float(po.total_amount)
            if po.status == StatusPO.LUNAS:
                supplier_map[sid]["total_lunas"] += float(po.total_amount)
            else:
                supplier_map[sid]["total_outstanding"] += float(po.total_amount)

        per_supplier = [PengeluaranPerSupplier(**v) for v in supplier_map.values()]

        bahan_map: dict[int, dict] = {}
        for po in all_po:
            for item in po.items:
                bid = item.bahan_baku_id
                if bid not in bahan_map:
                    bahan_map[bid] = {
                        "bahan_baku_id": bid,
                        "bahan_baku_nama": item.bahan_baku.nama if item.bahan_baku else "-",
                        "total_jumlah": 0.0,
                        "satuan": item.satuan,
                        "total_pengeluaran": 0.0,
                    }
                bahan_map[bid]["total_jumlah"] += float(item.jumlah)
                bahan_map[bid]["total_pengeluaran"] += float(item.subtotal)

        per_bahan = [PengeluaranPerBahan(**v) for v in bahan_map.values()]
        per_bahan.sort(key=lambda x: x.total_pengeluaran, reverse=True)

        return LaporanPengeluaranResponse(
            periode_dari=dari,
            periode_sampai=sampai,
            generated_at=now,
            total_pengeluaran=round(total_pengeluaran, 2),
            total_lunas=round(total_lunas, 2),
            total_outstanding=round(total_outstanding, 2),
            total_jatuh_tempo=round(total_jatuh_tempo, 2),
            jumlah_po=len(all_po),
            jumlah_po_outstanding=len(po_outstanding),
            per_supplier=per_supplier,
            per_bahan=per_bahan,
            po_outstanding=po_outstanding,
        )
