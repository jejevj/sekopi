from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundException, PermissionDeniedException
from app.models.manufacturing_order import ManufacturingOrder, MOLine, MOBahanBaku, StatusMO
from app.models.stok import Stok, TipeTransaksiStok
from app.models.user import UserRole
from app.repositories.mo_repo import MORepository
from app.repositories.stok_repo import StokRepository
from app.schemas.manufacturing_order import (
    ManufacturingOrderCreate,
    ManufacturingOrderUpdate,
    ManufacturingOrderUpdateStatus,
)

STATUS_TRANSITIONS: dict[StatusMO, list[StatusMO]] = {
    StatusMO.DRAFT: [StatusMO.CONFIRMED, StatusMO.CANCELLED],
    StatusMO.CONFIRMED: [StatusMO.IN_PROGRESS, StatusMO.CANCELLED],
    StatusMO.IN_PROGRESS: [StatusMO.DONE, StatusMO.CANCELLED],
    StatusMO.DONE: [],
    StatusMO.CANCELLED: [],
}

TRANSITION_ROLES: dict[tuple[StatusMO, StatusMO], set[UserRole]] = {
    (StatusMO.DRAFT, StatusMO.CONFIRMED):       {UserRole.ADMIN},
    (StatusMO.DRAFT, StatusMO.CANCELLED):       {UserRole.ADMIN, UserRole.PRODUKSI},
    (StatusMO.CONFIRMED, StatusMO.IN_PROGRESS): {UserRole.ADMIN, UserRole.INVENTORI},
    (StatusMO.CONFIRMED, StatusMO.CANCELLED):   {UserRole.ADMIN},
    (StatusMO.IN_PROGRESS, StatusMO.DONE):      {UserRole.ADMIN, UserRole.PRODUKSI},
    (StatusMO.IN_PROGRESS, StatusMO.CANCELLED): {UserRole.ADMIN},
}


class MOService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.mo_repo = MORepository(db)
        self.stok_repo = StokRepository(db)

    async def create_mo(
        self, payload: ManufacturingOrderCreate, user_id: int
    ) -> ManufacturingOrder:
        nomor_mo = await self.mo_repo.generate_nomor_mo()
        mo = ManufacturingOrder(
            nomor_mo=nomor_mo,
            tanggal_rencana=payload.tanggal_rencana,
            catatan=payload.catatan,
            created_by=user_id,
        )
        self.db.add(mo)
        await self.db.flush()

        for line_data in payload.lines:
            line = MOLine(
                mo_id=mo.id,
                menu_id=line_data.menu_id,
                nama_produk=line_data.nama_produk,
                target_qty=float(line_data.target_qty),
                satuan=line_data.satuan,
            )
            self.db.add(line)
            await self.db.flush()
            for bb in line_data.bahan_baku_lines:
                self.db.add(MOBahanBaku(
                    mo_line_id=line.id,
                    bahan_baku_id=bb.bahan_baku_id,
                    qty_rencana=float(bb.qty_rencana),
                    qty_per_unit=float(bb.qty_per_unit) if bb.qty_per_unit is not None else None,
                    satuan=bb.satuan,
                ))

        await self.db.commit()
        await self.db.refresh(mo)
        return mo

    async def update_mo(
        self, mo_id: int, payload: ManufacturingOrderUpdate
    ) -> ManufacturingOrder:
        mo = await self.mo_repo.get(mo_id)
        if not mo:
            raise NotFoundException(f"Manufacturing Order ID {mo_id} tidak ditemukan")
        if mo.status not in [StatusMO.DRAFT]:
            raise PermissionDeniedException()
        for field, value in payload.model_dump(exclude_none=True).items():
            setattr(mo, field, value)
        await self.db.commit()
        await self.db.refresh(mo)
        return mo

    async def update_status(
        self,
        mo_id: int,
        payload: ManufacturingOrderUpdateStatus,
        user_id: int,
        user_role: UserRole,
    ) -> ManufacturingOrder:
        mo = await self.mo_repo.get_with_lines(mo_id)
        if not mo:
            raise NotFoundException(f"Manufacturing Order ID {mo_id} tidak ditemukan")

        allowed_next = STATUS_TRANSITIONS.get(mo.status, [])
        if payload.status not in allowed_next:
            raise ValueError(
                f"Transisi status dari '{mo.status}' ke '{payload.status}' tidak diizinkan."
            )

        allowed_roles = TRANSITION_ROLES.get((mo.status, payload.status), set())
        if user_role not in allowed_roles:
            raise PermissionDeniedException(
                f"Role '{user_role}' tidak diizinkan melakukan transisi ini."
            )

        now = datetime.now(timezone.utc)

        # CONFIRMED: validasi stok untuk semua bahan di semua line
        if payload.status == StatusMO.CONFIRMED:
            for line in mo.lines:
                for bb in line.bahan_baku_lines:
                    saldo = await self.stok_repo.get_stok_saldo(bb.bahan_baku_id)
                    if saldo < float(bb.qty_rencana):
                        raise ValueError(
                            f"Stok tidak cukup untuk bahan ID {bb.bahan_baku_id} "
                            f"(line: {line.nama_produk}). "
                            f"Tersedia: {saldo}, Dibutuhkan: {bb.qty_rencana}"
                        )
            mo.approved_by = user_id
            mo.approved_at = now

        # IN_PROGRESS: keluarkan bahan dari stok (semua line)
        if payload.status == StatusMO.IN_PROGRESS:
            mo.tanggal_mulai = now
            mo.inventori_by = user_id
            mo.inventori_at = now
            for line in mo.lines:
                for bb in line.bahan_baku_lines:
                    self.db.add(Stok(
                        bahan_baku_id=bb.bahan_baku_id,
                        tipe=TipeTransaksiStok.KELUAR,
                        jumlah=float(bb.qty_rencana),
                        keterangan=f"Digunakan untuk MO {mo.nomor_mo} / {line.nama_produk}",
                        created_by=user_id,
                    ))

        # DONE: catat qty aktual & kembalikan sisa stok
        if payload.status == StatusMO.DONE:
            mo.tanggal_selesai = now
            # Build lookup: (mo_line_id, bahan_baku_id) → qty_aktual
            aktual_map: dict[tuple[int, int], float] = {}
            if payload.bahan_baku_aktual:
                for item in payload.bahan_baku_aktual:
                    lid = item.get("mo_line_id")
                    bid = item.get("bahan_baku_id")
                    qty = item.get("qty_aktual")
                    if lid is not None and bid is not None and qty is not None:
                        aktual_map[(lid, bid)] = float(qty)

            for line in mo.lines:
                for bb in line.bahan_baku_lines:
                    qty_aktual = aktual_map.get((line.id, bb.bahan_baku_id))
                    if qty_aktual is None:
                        qty_aktual = float(bb.qty_rencana)  # semua terpakai
                    bb.qty_aktual = qty_aktual
                    sisa = float(bb.qty_rencana) - qty_aktual
                    if sisa > 0.001:
                        self.db.add(Stok(
                            bahan_baku_id=bb.bahan_baku_id,
                            tipe=TipeTransaksiStok.MASUK,
                            jumlah=round(sisa, 4),
                            keterangan=f"Sisa produksi MO {mo.nomor_mo} / {line.nama_produk}",
                            created_by=user_id,
                        ))

        # CANCELLED: kembalikan stok jika sudah IN_PROGRESS
        if payload.status == StatusMO.CANCELLED and mo.status == StatusMO.IN_PROGRESS:
            for line in mo.lines:
                for bb in line.bahan_baku_lines:
                    self.db.add(Stok(
                        bahan_baku_id=bb.bahan_baku_id,
                        tipe=TipeTransaksiStok.MASUK,
                        jumlah=float(bb.qty_rencana),
                        keterangan=f"Stok dikembalikan dari MO {mo.nomor_mo} ({line.nama_produk}) yang dibatalkan",
                        created_by=user_id,
                    ))

        mo.status = payload.status
        if payload.catatan:
            mo.catatan = payload.catatan

        await self.db.commit()
        await self.db.refresh(mo)
        return mo

    async def check_stok_availability(self, mo_id: int) -> dict:
        mo = await self.mo_repo.get_with_lines(mo_id)
        if not mo:
            raise NotFoundException(f"MO ID {mo_id} tidak ditemukan")
        lines_result = []
        all_available = True
        for line in mo.lines:
            bahan_result = []
            for bb in line.bahan_baku_lines:
                saldo = await self.stok_repo.get_stok_saldo(bb.bahan_baku_id)
                cukup = saldo >= float(bb.qty_rencana)
                if not cukup:
                    all_available = False
                bahan_result.append({
                    "bahan_baku_id": bb.bahan_baku_id,
                    "nama": bb.bahan_baku.nama if bb.bahan_baku else "-",
                    "satuan": bb.bahan_baku.satuan if bb.bahan_baku else "-",
                    "satuan_display": bb.bahan_baku.satuan_display if bb.bahan_baku else None,
                    "konversi_factor": float(bb.bahan_baku.konversi_factor)
                        if bb.bahan_baku and bb.bahan_baku.konversi_factor else None,
                    "qty_rencana": float(bb.qty_rencana),
                    "stok_tersedia": saldo,
                    "cukup": cukup,
                    "kekurangan": max(0, float(bb.qty_rencana) - saldo),
                })
            lines_result.append({
                "mo_line_id": line.id,
                "nama_produk": line.nama_produk,
                "target_qty": float(line.target_qty),
                "satuan": line.satuan,
                "bahan": bahan_result,
            })
        return {
            "mo_id": mo_id,
            "nomor_mo": mo.nomor_mo,
            "all_available": all_available,
            "lines": lines_result,
        }
