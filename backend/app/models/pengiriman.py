import enum
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


def _enum_values(enum_cls):
    return [e.value for e in enum_cls]


class StatusPengiriman(str, enum.Enum):
    PENDING          = "pending"
    DALAM_PERJALANAN = "dalam_perjalanan"
    TERKIRIM         = "terkirim"
    GAGAL            = "gagal"


class Pengiriman(Base):
    __tablename__ = "pengiriman"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    driver_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    tujuan: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[StatusPengiriman] = mapped_column(
        Enum(StatusPengiriman, values_callable=_enum_values),
        default=StatusPengiriman.PENDING,
    )
    catatan: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    tanggal_kirim: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    tanggal_tiba: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    driver = relationship("User", lazy="selectin")
