from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


class Penjualan(Base):
    __tablename__ = "penjualan"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    production_unit_id: Mapped[int] = mapped_column(ForeignKey("production_units.id"), unique=True, nullable=False)
    barcode: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    nama_produk: Mapped[str] = mapped_column(String(255), nullable=False)
    harga: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    catatan: Mapped[str | None] = mapped_column(String(500), nullable=True)
    kasir_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    gerobak_id: Mapped[int | None] = mapped_column(ForeignKey("gerobak.id"), nullable=True, index=True)
    sold_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    production_unit = relationship("ProductionUnit", lazy="selectin")
    kasir = relationship("User", lazy="selectin")
    gerobak = relationship("Gerobak", lazy="selectin")
