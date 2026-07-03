import enum
from datetime import date, datetime, timezone
from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base_class import Base


class StatusDividen(str, enum.Enum):
    PENDING = "pending"
    DIBAYAR = "dibayar"


class GajiKaryawan(Base):
    """Record penggajian satu periode — admin input manual total nominal."""
    __tablename__ = "gaji_karyawan"

    id:             Mapped[int]       = mapped_column(primary_key=True, index=True)
    periode_label:  Mapped[str]       = mapped_column(String(50), nullable=False)
    periode_dari:   Mapped[date]      = mapped_column(Date, nullable=False, index=True)
    periode_sampai: Mapped[date]      = mapped_column(Date, nullable=False)
    total_gaji:     Mapped[float]     = mapped_column(Numeric(14, 2), nullable=False)
    catatan:        Mapped[str|None]  = mapped_column(String(500), nullable=True)
    dibuat_oleh:    Mapped[int]       = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at:     Mapped[datetime]  = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    dibuat_user = relationship("User", foreign_keys=[dibuat_oleh], lazy="selectin")


class DividenDistribusi(Base):
    """
    Satu record = dividen satu USER dalam satu GRUP untuk satu periode.
    Kolom status disimpan sebagai VARCHAR(20) di DB — gunakan String bukan Enum
    agar SQLAlchemy tidak meng-generate ::statusdividen cast ke PostgreSQL.
    """
    __tablename__ = "dividen_distribusi"

    id:               Mapped[int]   = mapped_column(primary_key=True, index=True)
    group_id:         Mapped[int]   = mapped_column(ForeignKey("shareholder_groups.id"), nullable=False, index=True)
    user_id:          Mapped[int]   = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    periode_label:    Mapped[str]   = mapped_column(String(50), nullable=False)
    periode_dari:     Mapped[date]  = mapped_column(Date, nullable=False)
    periode_sampai:   Mapped[date]  = mapped_column(Date, nullable=False)

    total_penjualan:  Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    total_pembelian:  Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    total_gaji_grup:  Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    laba_bersih_grup: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)

    porsi_saham:      Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    jumlah_dividen:   Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)

    # Pakai String(20) bukan Enum — DB kolom adalah VARCHAR(20)
    # Bandingkan dengan StatusDividen.value secara manual di endpoint
    status:           Mapped[str]   = mapped_column(
        String(20), nullable=False, default=StatusDividen.PENDING.value, server_default="pending"
    )
    tanggal_bayar:    Mapped[date|None]   = mapped_column(Date, nullable=True)
    catatan:          Mapped[str|None]    = mapped_column(String(500), nullable=True)
    dibuat_oleh:      Mapped[int]         = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at:       Mapped[datetime]    = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    group       = relationship("ShareholderGroup", lazy="selectin")
    user        = relationship("User", foreign_keys=[user_id], lazy="selectin")
    dibuat_user = relationship("User", foreign_keys=[dibuat_oleh], lazy="selectin")
