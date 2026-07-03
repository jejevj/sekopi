from datetime import datetime, timezone

from sqlalchemy import DateTime, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base


class BahanBaku(Base):
    __tablename__ = "bahan_baku"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    nama: Mapped[str] = mapped_column(String(255), nullable=False)
    satuan: Mapped[str] = mapped_column(String(50), nullable=False)
    satuan_display: Mapped[str | None] = mapped_column(String(50), nullable=True)
    konversi_factor: Mapped[float | None] = mapped_column(Numeric(10, 4), nullable=True)
    stok_minimum: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    # Harga beli per 1 satuan referensi (Rp/kg, Rp/liter, Rp/pcs, Rp/kaleng)
    harga_beli_per_satuan: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)
    deskripsi: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
