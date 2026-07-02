from datetime import datetime, timezone

from sqlalchemy import DateTime, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class BahanBaku(Base):
    __tablename__ = "bahan_baku"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    nama: Mapped[str] = mapped_column(String(255), nullable=False)
    satuan: Mapped[str] = mapped_column(String(50), nullable=False)  # kg, liter, pcs
    stok_minimum: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    deskripsi: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
