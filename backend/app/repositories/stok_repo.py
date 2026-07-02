from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.stok import Stok, TipeTransaksiStok
from app.models.bahan_baku import BahanBaku
from app.repositories.base import BaseRepository


class StokRepository(BaseRepository[Stok]):
    def __init__(self, db: AsyncSession):
        super().__init__(Stok, db)

    async def get_stok_saldo(self, bahan_baku_id: int) -> float:
        masuk = await self.db.execute(
            select(func.sum(Stok.jumlah)).where(
                Stok.bahan_baku_id == bahan_baku_id,
                Stok.tipe == TipeTransaksiStok.MASUK,
            )
        )
        keluar = await self.db.execute(
            select(func.sum(Stok.jumlah)).where(
                Stok.bahan_baku_id == bahan_baku_id,
                Stok.tipe == TipeTransaksiStok.KELUAR,
            )
        )
        total_masuk = masuk.scalar() or 0
        total_keluar = keluar.scalar() or 0
        return float(total_masuk) - float(total_keluar)
