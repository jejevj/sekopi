import enum
from datetime import date, datetime, time, timezone

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Integer, String, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


def _enum_values(e):
    return [x.value for x in e]


class StatusAbsensi(str, enum.Enum):
    HADIR      = "hadir"
    IZIN       = "izin"
    SAKIT      = "sakit"
    ALPHA      = "alpha"


class Absensi(Base):
    """Rekam absensi harian per user."""
    __tablename__ = "absensi"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tanggal: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    status: Mapped[StatusAbsensi] = mapped_column(
        Enum(StatusAbsensi, values_callable=_enum_values),
        nullable=False,
        default=StatusAbsensi.HADIR,
    )

    jam_masuk: Mapped[time | None] = mapped_column(Time, nullable=True)
    jam_keluar: Mapped[time | None] = mapped_column(Time, nullable=True)

    keterangan: Mapped[str | None] = mapped_column(String(500), nullable=True)
    dicatat_oleh: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # relationships
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id], lazy="joined")  # type: ignore
    pencatat: Mapped["User | None"] = relationship("User", foreign_keys=[dicatat_oleh], lazy="joined")  # type: ignore
