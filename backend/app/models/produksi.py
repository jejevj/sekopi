import enum
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


class StatusProduksi(str, enum.Enum):
    DRAFT = "draft"
    PROSES = "proses"
    SELESAI = "selesai"
    BATAL = "batal"


class Produksi(Base):
    __tablename__ = "produksi"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    nama_batch: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[StatusProduksi] = mapped_column(Enum(StatusProduksi), default=StatusProduksi.DRAFT)
    jumlah_output: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    satuan_output: Mapped[str] = mapped_column(String(50), nullable=False)
    catatan: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user = relationship("User", lazy="selectin")
