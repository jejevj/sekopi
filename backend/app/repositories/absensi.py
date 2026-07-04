from datetime import date
from typing import Optional

from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from app.models.absensi import Absensi, StatusAbsensi
from app.schemas.absensi import AbsensiCreate, AbsensiUpdate


class AbsensiRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, absensi_id: int) -> Optional[Absensi]:
        return self.db.get(Absensi, absensi_id)

    def get_by_user_tanggal(self, user_id: int, tanggal: date) -> Optional[Absensi]:
        return self.db.scalar(
            select(Absensi).where(and_(Absensi.user_id == user_id, Absensi.tanggal == tanggal))
        )

    def list_by_tanggal(self, tanggal: date) -> list[Absensi]:
        return list(
            self.db.scalars(select(Absensi).where(Absensi.tanggal == tanggal).order_by(Absensi.user_id))
        )

    def list_by_user(self, user_id: int, dari: date, sampai: date) -> list[Absensi]:
        return list(
            self.db.scalars(
                select(Absensi).where(
                    and_(Absensi.user_id == user_id, Absensi.tanggal >= dari, Absensi.tanggal <= sampai)
                ).order_by(Absensi.tanggal.desc())
            )
        )

    def list_range(self, dari: date, sampai: date) -> list[Absensi]:
        return list(
            self.db.scalars(
                select(Absensi).where(
                    and_(Absensi.tanggal >= dari, Absensi.tanggal <= sampai)
                ).order_by(Absensi.tanggal.desc(), Absensi.user_id)
            )
        )

    def create(self, data: AbsensiCreate, dicatat_oleh: int,
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
            dicatat_oleh=dicatat_oleh,
        )
        self.db.add(obj)
        self.db.commit()
        self.db.refresh(obj)
        return obj

    def update(self, obj: Absensi, data: AbsensiUpdate) -> Absensi:
        for field, val in data.model_dump(exclude_unset=True).items():
            setattr(obj, field, val)
        self.db.commit()
        self.db.refresh(obj)
        return obj

    def delete(self, obj: Absensi) -> None:
        self.db.delete(obj)
        self.db.commit()
