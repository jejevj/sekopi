"""Model konfigurasi lokasi absensi per gerobak / per lokasi kerja."""
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base


class AbsensiSetting(Base):
    """
    Titik koordinat absensi yang diizinkan.
    Satu baris = satu lokasi kerja (bisa banyak lokasi).
    is_active = True → lokasi ini aktif dipakai untuk validasi.
    """
    __tablename__ = "absensi_settings"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    nama_lokasi: Mapped[str] = mapped_column(String(255), nullable=False)

    # Koordinat pusat
    latitude: Mapped[float] = mapped_column(Numeric(10, 7), nullable=False)
    longitude: Mapped[float] = mapped_column(Numeric(10, 7), nullable=False)

    # Radius toleransi dalam meter
    radius_meter: Mapped[int] = mapped_column(Integer, nullable=False, default=100)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
