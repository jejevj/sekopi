import enum
from datetime import date, datetime, timezone
from sqlalchemy import Date, DateTime, Enum, ForeignKey, Numeric, String, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base_class import Base


class KategoriPengeluaran(str, enum.Enum):
    GAJI       = "gaji"
    OPERASIONAL = "operasional"
    BAHAN_BAKU = "bahan_baku"
    UTILITAS   = "utilitas"
    LAINNYA    = "lainnya"


class Pengeluaran(Base):
    """
    Pengeluaran operasional yang akan dikurangi dari laba sebelum kalkulasi dividen.
    Pengeluaran dibagi rata ke semua grup shareholder.
    """
    __tablename__ = "pengeluaran"

    id:            Mapped[int]                  = mapped_column(primary_key=True, index=True)
    nama:          Mapped[str]                  = mapped_column(String(200), nullable=False)
    jumlah:        Mapped[float]                = mapped_column(Numeric(14, 2), nullable=False)
    kategori:      Mapped[KategoriPengeluaran]  = mapped_column(
        Enum(KategoriPengeluaran, values_callable=lambda e: [x.value for x in e]),
        default=KategoriPengeluaran.LAINNYA,
        nullable=False,
    )
    tanggal:       Mapped[date]                 = mapped_column(Date, nullable=False, index=True)
    catatan:       Mapped[str | None]           = mapped_column(String(500), nullable=True)
    dibuat_oleh:   Mapped[int]                  = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at:    Mapped[datetime]             = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    dibuat_user = relationship("User", foreign_keys=[dibuat_oleh], lazy="selectin")
