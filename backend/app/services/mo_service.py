from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundException, PermissionDeniedException
from app.models.manufacturing_order import ManufacturingOrder, MOBahanBaku, StatusMO
from app.models.stok import Stok, TipeTransaksiStok
from app.models.user import UserRole
from app.repositories.mo_repo import MORepository
from app.repositories.stok_repo import StokRepository
from app.schemas.manufacturing_order import (
    ManufacturingOrderCreate,
    ManufacturingOrderUpdate,
    ManufacturingOrderUpdateStatus,
)

# Transisi yang diizinkan per status
STATUS_TRANSITIONS: dict[StatusMO, list[StatusMO]] = {
    StatusMO.DRAFT: [StatusMO.CONFIRMED, StatusMO.CANCELLED],
    StatusMO.CONFIRMED: [StatusMO.IN_PROGRESS, StatusMO.CANCELLED],
    StatusMO.IN_PROGRESS: [StatusMO.DONE, StatusMO.CANCELLED],
    StatusMO.DONE: [],
    StatusMO.CANCELLED: [],
}

# Role yang diizinkan untuk setiap transisi
# key: (from_status, to_status) -> set of roles allowed
TRANSITION_ROLES: dict[tuple[StatusMO, StatusMO], set[UserRole]] = {
    # PRODUKSI atau ADMIN bisa buat draft & submit ke admin
    (StatusMO.DRAFT, StatusMO.CONFIRMED): {UserRole.ADMIN},
    (StatusMO.DRAFT, StatusMO.CANCELLED): {UserRole.ADMIN, UserRole.PRODUKSI},
    # Hanya INVENTORI (atau ADMIN) yang bisa mulai proses (keluarkan bahan)
    (StatusMO.CONFIRMED, StatusMO.IN_PROGRESS): {UserRole.ADMIN, UserRole.INVENTORI},
    (StatusMO.CONFIRMED, StatusMO.CANCELLED): {UserRole.ADMIN},
    # PRODUKSI atau ADMIN yang selesaikan MO
    (StatusMO.IN_PROGRESS, StatusMO.DONE): {UserRole.ADMIN, UserRole.PRODUKSI},
    (StatusMO.IN_PROGRESS, StatusMO.CANCELLED): {UserRole.ADMIN},
}


class MOService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.mo_repo = MORepository(db)
        self.stok_repo = StokRepository(db)

    async def create_mo(self, payload: ManufacturingOrderCreate, user_id: int) -> ManufacturingOrder:
        nomor_mo = await self.mo_repo.generate_nomor_mo()

        mo = ManufacturingOrder(
            nomor_mo=nomor_mo,
            nama_produk=payload.nama_produk,
            target_qty=float(payload.target_qty),
            satuan=payload.satuan,
            tanggal_rencana=payload.tanggal_rencana,
            catatan=payload.catatan,
            created_by=user_id,
        )
        self.db.add(mo)
        await self.db.flush()

        for line in payload.bahan_baku_lines:
            mo_line = MOBahanBaku(
                mo_id=mo.id,
                bahan_baku_id=line.bahan_baku_id,
                qty_rencana=float(line.qty_rencana),
                satuan=line.satuan,
            )
            self.db.add(mo_line)

        await self.db.commit()
        await self.db.refresh(mo)
        return mo

    async def update_status(
        self, mo_id: int, payload: ManufacturingOrderUpdateStatus, user_id: int, user_role: UserRole
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

        # CONFIRMED: admin setujui — cek stok tersedia
        if payload.status == StatusMO.CONFIRMED:
            for line in mo.bahan_baku_lines:
                saldo = await self.stok_repo.get_stok_saldo(line.bahan_baku_id)
                if saldo < float(line.qty_rencana):
                    raise ValueError(
                        f"Stok tidak cukup untuk bahan ID {line.bahan_baku_id}. "
                        f"Tersedia: {saldo}, Dibutuhkan: {line.qty_rencana}"
                    )
            mo.approved_by = user_id
            mo.approved_at = now

        # IN_PROGRESS: inventori keluarkan bahan
        if payload.status == StatusMO.IN_PROGRESS:
            mo.tanggal_mulai = now
            mo.inventori_by = user_id
            mo.inventori_at = now
            for line in mo.bahan_baku_lines:
                stok_keluar = Stok(
                    bahan_baku_id=line.bahan_baku_id,
                    tipe=TipeTransaksiStok.KELUAR,
                    jumlah=float(line.qty_rencana),
                    keterangan=f"Digunakan untuk MO {mo.nomor_mo}",
                    created_by=user_id,
                )
                self.db.add(stok_keluar)

        # DONE: catat qty aktual & waktu selesai
        if payload.status == StatusMO.DONE:
            mo.tanggal_selesai = now
            if payload.bahan_baku_aktual:
                for item in payload.bahan_baku_aktual:
                    for line in mo.bahan_baku_lines:
                        if line.bahan_baku_id == item.get("bahan_baku_id"):
                            line.qty_aktual = item.get("qty_aktual")

        # CANCELLED: kembalikan stok jika sudah IN_PROGRESS
        if payload.status == StatusMO.CANCELLED and mo.status == StatusMO.IN_PROGRESS:
            for line in mo.bahan_baku_lines:
                stok_kembali = Stok(
                    bahan_baku_id=line.bahan_baku_id,
                    tipe=TipeTransaksiStok.MASUK,
                    jumlah=float(line.qty_rencana),
                    keterangan=f"Stok dikembalikan dari MO {mo.nomor_mo} yang dibatalkan",
                    created_by=user_id,
                )
                self.db.add(stok_kembali)

        mo.status = payload.status
        if payload.catatan:
            mo.catatan = payload.catatan

        await self.db.commit()
        await self.db.refresh(mo)
        return mo

    async def update_mo(self, mo_id: int, payload: ManufacturingOrderUpdate) -> ManufacturingOrder:
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

    async def check_stok_availability(self, mo_id: int) -> dict:
        mo = await self.mo_repo.get_with_lines(mo_id)
        if not mo:
            raise NotFoundException(f"MO ID {mo_id} tidak ditemukan")

        result = []
        all_available = True
        for line in mo.bahan_baku_lines:
            saldo = await self.stok_repo.get_stok_saldo(line.bahan_baku_id)
            cukup = saldo >= float(line.qty_rencana)
            if not cukup:
                all_available = False
            result.append({
                "bahan_baku_id": line.bahan_baku_id,
                "nama": line.bahan_baku.nama if line.bahan_baku else "-",
                "qty_rencana": float(line.qty_rencana),
                "stok_tersedia": saldo,
                "cukup": cukup,
                "kekurangan": max(0, float(line.qty_rencana) - saldo),
            })

        return {
            "mo_id": mo_id,
            "nomor_mo": mo.nomor_mo,
            "all_available": all_available,
            "detail": result,
        }
