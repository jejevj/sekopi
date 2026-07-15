from datetime import date
from typing import Optional

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.absensi import Absensi
from app.schemas.absensi import AbsensiCreate, AbsensiUpdate


class AbsensiRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, absensi_id: int) -> Optional[Absensi]:
        return await self.db.get(Absensi, absensi_id)

    async def get_by_user_tanggal(self, user_id: int, tanggal: date) -> Optional[Absensi]:
        result = await self.db.execute(
            select(Absensi).where(and_(Absensi.user_id == user_id, Absensi.tanggal == tanggal))
        )
        return result.scalar_one_or_none()

    async def list_by_tanggal(self, tanggal: date) -> list[Absensi]:
        result = await self.db.execute(
            select(Absensi).where(Absensi.tanggal == tanggal).order_by(Absensi.user_id)
        )
        return list(result.scalars().all())

    async def list_by_user(self, user_id: int, dari: date, sampai: date) -> list[Absensi]:
        result = await self.db.execute(
            select(Absensi).where(
                and_(Absensi.user_id == user_id, Absensi.tanggal >= dari, Absensi.tanggal <= sampai)
            ).order_by(Absensi.tanggal.desc())
        )
        return list(result.scalars().all())

    async def list_range(self, dari: date, sampai: date) -> list[Absensi]:
        result = await self.db.execute(
            select(Absensi).where(
                and_(Absensi.tanggal >= dari, Absensi.tanggal <= sampai)
            ).order_by(Absensi.tanggal.desc(), Absensi.user_id)
        )
        return list(result.scalars().all())

    async def create(self, data: AbsensiCreate, dicatat_oleh: int,
                     jarak_meter: Optional[float] = None,
                     dalam_radius: Optional[bool] = None) -> Absensi:
        obj = Absensi(
            user_id=data.user_id,
            tanggal=data.tanggal,
            status=data.status,
            jam_masuk=data.jam_masuk,
            jam_keluar=data.jam_keluar,
            keterangan=data.keterangan,
            latitude=data.latitude,
            longitude=data.longitude,
            jarak_meter=jarak_meter,
            dalam_radius=dalam_radius,
            foto_url=data.foto_url,
            # foto_keluar_url tidak diisi saat create (hanya saat catat pulang)
            foto_keluar_url=None,
            dicatat_oleh=dicatat_oleh,
        )
        self.db.add(obj)
        await self.db.commit()
        await self.db.refresh(obj)
        return obj

    async def update(self, obj: Absensi, data: AbsensiUpdate) -> Absensi:
        """
        Update hanya field yang di-set (exclude_unset=True).
        Field yang tidak dikirim dari payload tidak akan di-write ke DB,
        sehingga foto_url (masuk) aman dari penimpaan saat catat_pulang.
        """
        for field, val in data.model_dump(exclude_unset=True).items():
            setattr(obj, field, val)
        await self.db.commit()
        await self.db.refresh(obj)
        return obj

    async def delete(self, obj: Absensi) -> None:
        await self.db.delete(obj)
        await self.db.commit()
