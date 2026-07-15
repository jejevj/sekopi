from datetime import date
from typing import Optional

from fastapi import HTTPException, status

from app.repositories.absensi import AbsensiRepository
from app.repositories.absensi_setting import AbsensiSettingRepository
from app.schemas.absensi import (
    AbsensiCreate, AbsensiRekapHarian, AbsensiResponse,
    AbsensiSettingCreate, AbsensiSettingResponse, AbsensiSettingUpdate,
    AbsensiUpdate, AbsensiPulangUpdate, haversine_meter,
)


class AbsensiSettingService:
    def __init__(self, repo: AbsensiSettingRepository):
        self.repo = repo

    async def list_all(self) -> list[AbsensiSettingResponse]:
        rows = await self.repo.list_all()
        return [AbsensiSettingResponse.from_orm_obj(o) for o in rows]

    async def get(self, setting_id: int) -> AbsensiSettingResponse:
        obj = await self.repo.get_by_id(setting_id)
        if not obj:
            raise HTTPException(404, "Setting tidak ditemukan")
        return AbsensiSettingResponse.from_orm_obj(obj)

    async def create(self, data: AbsensiSettingCreate) -> AbsensiSettingResponse:
        obj = await self.repo.create(data)
        return AbsensiSettingResponse.from_orm_obj(obj)

    async def update(self, setting_id: int, data: AbsensiSettingUpdate) -> AbsensiSettingResponse:
        obj = await self.repo.get_by_id(setting_id)
        if not obj:
            raise HTTPException(404, "Setting tidak ditemukan")
        obj = await self.repo.update(obj, data)
        return AbsensiSettingResponse.from_orm_obj(obj)

    async def delete(self, setting_id: int) -> None:
        obj = await self.repo.get_by_id(setting_id)
        if not obj:
            raise HTTPException(404, "Setting tidak ditemukan")
        await self.repo.delete(obj)


class AbsensiService:
    def __init__(self, repo: AbsensiRepository, setting_repo: AbsensiSettingRepository):
        self.repo = repo
        self.setting_repo = setting_repo

    async def _hitung_jarak(self, lat: float, lon: float):
        settings = await self.setting_repo.list_active()
        if not settings:
            return None, None
        jarak_min = min(
            haversine_meter(lat, lon, float(s.latitude), float(s.longitude))
            for s in settings
        )
        dalam_radius = any(
            haversine_meter(lat, lon, float(s.latitude), float(s.longitude)) <= s.radius_meter
            for s in settings
        )
        return round(jarak_min, 2), dalam_radius

    async def catat(self, data: AbsensiCreate, dicatat_oleh: int,
                    enforce_radius: bool = False) -> AbsensiResponse:
        existing = await self.repo.get_by_user_tanggal(data.user_id, data.tanggal)
        if existing:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail=f"Absensi user {data.user_id} pada {data.tanggal} sudah ada.",
            )
        jarak = dalam_radius = None
        if data.latitude is not None and data.longitude is not None:
            jarak, dalam_radius = await self._hitung_jarak(data.latitude, data.longitude)
            if enforce_radius and dalam_radius is False:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    detail=f"Lokasi terlalu jauh dari titik absensi ({jarak:.0f} m).",
                )
        obj = await self.repo.create(data, dicatat_oleh, jarak_meter=jarak, dalam_radius=dalam_radius)
        return AbsensiResponse.from_orm_obj(obj)

    async def get(self, absensi_id: int) -> AbsensiResponse:
        obj = await self.repo.get_by_id(absensi_id)
        if not obj:
            raise HTTPException(404, "Absensi tidak ditemukan")
        return AbsensiResponse.from_orm_obj(obj)

    async def get_hari_ini(self, user_id: int, tanggal: date) -> Optional[AbsensiResponse]:
        """Ambil absensi user pada tanggal tertentu. Return None jika belum ada."""
        obj = await self.repo.get_by_user_tanggal(user_id, tanggal)
        if not obj:
            return None
        return AbsensiResponse.from_orm_obj(obj)

    async def catat_pulang(
        self,
        absensi_id: int,
        data: AbsensiPulangUpdate,
        current_user_id: int,
    ) -> AbsensiResponse:
        """
        Update jam_keluar dan foto_keluar_url.
        foto_url (masuk) TIDAK disentuh sama sekali.
        Menggunakan model_dump(exclude_none=True) agar field None
        tidak ikut di-write ke DB.
        """
        obj = await self.repo.get_by_id(absensi_id)
        if not obj:
            raise HTTPException(404, "Absensi tidak ditemukan")
        if obj.user_id != current_user_id:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                detail="Tidak bisa mengubah absensi milik user lain.",
            )
        if obj.jam_keluar is not None:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail="Jam pulang sudah tercatat sebelumnya.",
            )

        # Hitung jarak pulang kalau ada koordinat
        if data.latitude is not None and data.longitude is not None:
            await self._hitung_jarak(data.latitude, data.longitude)

        # Bangun payload hanya dari field yang benar-benar di-set (bukan None)
        # Ini mencegah foto_keluar_url = None menimpa nilai yang sudah ada
        payload_dict: dict = {"jam_keluar": data.jam_keluar}
        if data.foto_keluar_url is not None:
            payload_dict["foto_keluar_url"] = data.foto_keluar_url

        update_payload = AbsensiUpdate(**payload_dict)
        obj = await self.repo.update(obj, update_payload)
        return AbsensiResponse.from_orm_obj(obj)

    async def update(self, absensi_id: int, data: AbsensiUpdate) -> AbsensiResponse:
        obj = await self.repo.get_by_id(absensi_id)
        if not obj:
            raise HTTPException(404, "Absensi tidak ditemukan")
        obj = await self.repo.update(obj, data)
        return AbsensiResponse.from_orm_obj(obj)

    async def delete(self, absensi_id: int) -> None:
        obj = await self.repo.get_by_id(absensi_id)
        if not obj:
            raise HTTPException(404, "Absensi tidak ditemukan")
        await self.repo.delete(obj)

    async def rekap_harian(self, tanggal: date) -> AbsensiRekapHarian:
        records = await self.repo.list_by_tanggal(tanggal)
        resp = [AbsensiResponse.from_orm_obj(r) for r in records]
        return AbsensiRekapHarian(
            tanggal=tanggal,
            total=len(records),
            hadir=sum(1 for r in records if r.status.value == "hadir"),
            izin=sum(1 for r in records if r.status.value == "izin"),
            sakit=sum(1 for r in records if r.status.value == "sakit"),
            alpha=sum(1 for r in records if r.status.value == "alpha"),
            di_luar_radius=sum(1 for r in resp if r.dalam_radius is False),
            records=resp,
        )

    async def list_by_user(self, user_id: int, dari: date, sampai: date) -> list[AbsensiResponse]:
        rows = await self.repo.list_by_user(user_id, dari, sampai)
        return [AbsensiResponse.from_orm_obj(r) for r in rows]

    async def list_range(self, dari: date, sampai: date) -> list[AbsensiResponse]:
        rows = await self.repo.list_range(dari, sampai)
        return [AbsensiResponse.from_orm_obj(r) for r in rows]
