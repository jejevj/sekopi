import enum
from datetime import date, datetime, timezone
from sqlalchemy import Date, DateTime, Enum, ForeignKey, Numeric, String, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base_class import Base


class StatusDividen(str, enum.Enum):
    PENDING  = "pending"   # sudah dikalkulasi, belum dibayar
    DIBAYAR  = "dibayar"


class GajiKaryawan(Base):
    """Record penggajian satu periode — admin input manual total nominal."""
    __tablename__ = "gaji_karyawan"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    periode_label: Mapped[str] = mapped_column(String(50), nullable=False)          # "Juni 2026"
    periode_dari:  Mapped[date]  = mapped_column(Date, nullable=False, index=True)
    periode_sampai: Mapped[date] = mapped_column(Date, nullable=False)
    total_gaji:    Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)    # total semua karyawan
    catatan:       Mapped[str | None] = mapped_column(String(500), nullable=True)
    dibuat_oleh:   Mapped[int]  = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at:    Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    dibuat_user = relationship("User", foreign_keys=[dibuat_oleh], lazy="selectin")


class DividenDistribusi(Base):
    """
    Satu record = dividen satu grup untuk satu periode.
    Semua angka di-snapshot saat kalkulasi agar history tidak berubah.
    """
    __tablename__ = "dividen_distribusi"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    group_id:        Mapped[int]   = mapped_column(ForeignKey("shareholder_groups.id"), nullable=False, index=True)
    periode_label:   Mapped[str]   = mapped_column(String(50), nullable=False)
    periode_dari:    Mapped[date]  = mapped_column(Date, nullable=False)
    periode_sampai:  Mapped[date]  = mapped_column(Date, nullable=False)

    # Komponen kalkulasi (snapshot)
    total_penjualan: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)  # revenue periode
    total_pembelian: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)  # PO (tanggal_invoice)
    total_gaji_grup: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)  # total_gaji / jumlah_grup
    laba_bersih_grup: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False) # penjualan - pembelian - gaji_grup
    porsi_saham:     Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)   # snapshot % saat kalkulasi
    jumlah_dividen:  Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)  # laba_bersih_grup × porsi/100

    status:          Mapped[StatusDividen] = mapped_column(
        Enum(StatusDividen, values_callable=lambda e: [x.value for x in e]),
        default=StatusDividen.PENDING,
    )
    tanggal_bayar:   Mapped[date | None] = mapped_column(Date, nullable=True)
    catatan:         Mapped[str | None]  = mapped_column(String(500), nullable=True)
    dibuat_oleh:     Mapped[int]         = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at:      Mapped[datetime]    = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    group       = relationship("ShareholderGroup", lazy="selectin")
    dibuat_user = relationship("User", foreign_keys=[dibuat_oleh], lazy="selectin")
