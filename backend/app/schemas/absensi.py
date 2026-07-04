from datetime import date, time
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.models.absensi import StatusAbsensi


# ── Request ────────────────────────────────────────────────────────────────
class AbsensiCreate(BaseModel):
    user_id: int
    tanggal: date
    status: StatusAbsensi = StatusAbsensi.HADIR
    jam_masuk: Optional[time] = None
    jam_keluar: Optional[time] = None
    keterangan: Optional[str] = None


class AbsensiUpdate(BaseModel):
    status: Optional[StatusAbsensi] = None
    jam_masuk: Optional[time] = None
    jam_keluar: Optional[time] = None
    keterangan: Optional[str] = None


# ── Response ───────────────────────────────────────────────────────────────
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
            user=UserSnap.model_validate(obj.user),
            pencatat=UserSnap.model_validate(obj.pencatat) if obj.pencatat else None,
            created_at=obj.created_at.isoformat(),
        )


class AbsensiRekapHarian(BaseModel):
    """Summary satu hari untuk monitoring."""
    tanggal: date
    total: int
    hadir: int
    izin: int
    sakit: int
    alpha: int
    records: list[AbsensiResponse]
