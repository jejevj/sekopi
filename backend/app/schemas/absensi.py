import math
from datetime import date, time
from typing import Optional

from pydantic import BaseModel, ConfigDict, model_validator

from app.models.absensi import StatusAbsensi


# ── Haversine helper ───────────────────────────────────────────────────────
def haversine_meter(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6_371_000  # radius bumi dalam meter
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ── AbsensiSetting schemas ────────────────────────────────────────────────────
class AbsensiSettingCreate(BaseModel):
    nama_lokasi: str
    latitude: float
    longitude: float
    radius_meter: int = 100
    is_active: bool = True


class AbsensiSettingUpdate(BaseModel):
    nama_lokasi: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    radius_meter: Optional[int] = None
    is_active: Optional[bool] = None


class AbsensiSettingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    nama_lokasi: str
    latitude: float
    longitude: float
    radius_meter: int
    is_active: bool
    created_at: str
    updated_at: str

    @classmethod
    def from_orm_obj(cls, obj):
        return cls(
            id=obj.id,
            nama_lokasi=obj.nama_lokasi,
            latitude=float(obj.latitude),
            longitude=float(obj.longitude),
            radius_meter=obj.radius_meter,
            is_active=obj.is_active,
            created_at=obj.created_at.isoformat(),
            updated_at=obj.updated_at.isoformat(),
        )


# ── Absensi schemas ──────────────────────────────────────────────────────────────
class AbsensiCreate(BaseModel):
    user_id: int
    tanggal: date
    status: StatusAbsensi = StatusAbsensi.HADIR
    jam_masuk: Optional[time] = None
    jam_keluar: Optional[time] = None
    keterangan: Optional[str] = None
    # Lokasi — opsional (wajib dari mobile, opsional dari web/admin)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    # Foto URL — setelah upload ke storage
    foto_url: Optional[str] = None


class AbsensiUpdate(BaseModel):
    status: Optional[StatusAbsensi] = None
    jam_masuk: Optional[time] = None
    jam_keluar: Optional[time] = None
    keterangan: Optional[str] = None
    foto_url: Optional[str] = None


class UserSnap(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    full_name: str
    role: str


class AbsensiResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tanggal: date
    status: StatusAbsensi
    jam_masuk: Optional[time]
    jam_keluar: Optional[time]
    keterangan: Optional[str]
    latitude: Optional[float]
    longitude: Optional[float]
    jarak_meter: Optional[float]
    dalam_radius: Optional[bool]
    foto_url: Optional[str]
    user: UserSnap
    pencatat: Optional[UserSnap]
    created_at: str

    @classmethod
    def from_orm_obj(cls, obj):
        return cls(
            id=obj.id,
            tanggal=obj.tanggal,
            status=obj.status,
            jam_masuk=obj.jam_masuk,
            jam_keluar=obj.jam_keluar,
            keterangan=obj.keterangan,
            latitude=float(obj.latitude) if obj.latitude is not None else None,
            longitude=float(obj.longitude) if obj.longitude is not None else None,
            jarak_meter=float(obj.jarak_meter) if obj.jarak_meter is not None else None,
            dalam_radius=obj.dalam_radius,
            foto_url=obj.foto_url,
            user=UserSnap.model_validate(obj.user),
            pencatat=UserSnap.model_validate(obj.pencatat) if obj.pencatat else None,
            created_at=obj.created_at.isoformat(),
        )


class AbsensiRekapHarian(BaseModel):
    tanggal: date
    total: int
    hadir: int
    izin: int
    sakit: int
    alpha: int
    di_luar_radius: int
    records: list[AbsensiResponse]
