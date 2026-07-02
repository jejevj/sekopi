import enum
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class TipeTransaksiStok(str, enum.Enum):
    MASUK = "masuk"
    KELUAR = "keluar"


class Stok(Base):
    __tablename__ = "stok"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    bahan_baku_id: Mapped[int] = mapped_column(ForeignKey("bahan_baku.id"), nullable=False)
    tipe: Mapped[TipeTransaksiStok] = mapped_column(Enum(TipeTransaksiStok), nullable=False)
    jumlah: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    keterangan: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    bahan_baku = relationship("BahanBaku", lazy="selectin")
    user = relationship("User", lazy="selectin")
