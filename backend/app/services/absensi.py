from datetime import date
from typing import Optional

from fastapi import HTTPException, status

from app.repositories.absensi import AbsensiRepository
from app.schemas.absensi import (
    AbsensiCreate, AbsensiRekapHarian, AbsensiResponse, AbsensiUpdate,
)


class AbsensiService:
    def __init__(self, repo: AbsensiRepository):
        self.repo = repo

    def catat(self, data: AbsensiCreate, dicatat_oleh: int) -> AbsensiResponse:
        existing = self.repo.get_by_user_tanggal(data.user_id, data.tanggal)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Absensi untuk user {data.user_id} pada {data.tanggal} sudah ada.",
            )
        obj = self.repo.create(data, dicatat_oleh)
        return AbsensiResponse.from_orm_obj(obj)

    def get(self, absensi_id: int) -> AbsensiResponse:
        obj = self.repo.get_by_id(absensi_id)
        if not obj:
            raise HTTPException(status_code=404, detail="Absensi tidak ditemukan")
        return AbsensiResponse.from_orm_obj(obj)

    def update(self, absensi_id: int, data: AbsensiUpdate) -> AbsensiResponse:
        obj = self.repo.get_by_id(absensi_id)
        if not obj:
            raise HTTPException(status_code=404, detail="Absensi tidak ditemukan")
        obj = self.repo.update(obj, data)
        return AbsensiResponse.from_orm_obj(obj)

    def delete(self, absensi_id: int) -> None:
        obj = self.repo.get_by_id(absensi_id)
        if not obj:
            raise HTTPException(status_code=404, detail="Absensi tidak ditemukan")
        self.repo.delete(obj)

    def rekap_harian(self, tanggal: date) -> AbsensiRekapHarian:
        records = self.repo.list_by_tanggal(tanggal)
        return AbsensiRekapHarian(
            tanggal=tanggal,
            total=len(records),
            hadir=sum(1 for r in records if r.status.value == "hadir"),
            izin=sum(1 for r in records if r.status.value == "izin"),
            sakit=sum(1 for r in records if r.status.value == "sakit"),
            alpha=sum(1 for r in records if r.status.value == "alpha"),
            records=[AbsensiResponse.from_orm_obj(r) for r in records],
        )

    def list_by_user(self, user_id: int, dari: date, sampai: date) -> list[AbsensiResponse]:
        records = self.repo.list_by_user(user_id, dari, sampai)
        return [AbsensiResponse.from_orm_obj(r) for r in records]

    def list_range(self, dari: date, sampai: date) -> list[AbsensiResponse]:
        records = self.repo.list_range(dari, sampai)
        return [AbsensiResponse.from_orm_obj(r) for r in records]
