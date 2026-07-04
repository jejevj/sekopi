import enum
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Numeric, String, Text, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


def _enum_values(enum_cls):
    return [e.value for e in enum_cls]


class KategoriSelisih(str, enum.Enum):
    HUMAN_ERROR = "human_error"
    BAHAN       = "bahan"
    ALAT        = "alat"
    LAINNYA     = "lainnya"


class Menu(Base):
    """Master data menu/produk yang dijual."""
    __tablename__ = "menu"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    nama: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    deskripsi: Mapped[str | None] = mapped_column(Text, nullable=True)
    harga_jual: Mapped[float] = mapped_column(
        Numeric(12, 2), nullable=False,
        comment="Harga jual per unit ke pelanggan"
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    resep_list = relationship("Resep", back_populates="menu", lazy="selectin")

    @property
    def resep_aktif(self):
        for r in (self.resep_list or []):
            if r.is_active:
                return r
        return None


class Resep(Base):
    """Resep (BOM template) yang terikat ke satu Menu."""
    __tablename__ = "resep"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    menu_id: Mapped[int] = mapped_column(ForeignKey("menu.id"), nullable=False, index=True)
    nama_versi: Mapped[str] = mapped_column(
        String(100), nullable=False,
        comment="Contoh: v1, v2-less-sugar"
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False,
        comment="Hanya 1 resep per menu yang boleh aktif"
    )
    catatan: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    menu = relationship("Menu", back_populates="resep_list")
    bahan_list = relationship("ResepBahan", back_populates="resep", lazy="selectin")


class ResepBahan(Base):
    """Detail bahan baku per resep (BOM line)."""
    __tablename__ = "resep_bahan"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    resep_id: Mapped[int] = mapped_column(ForeignKey("resep.id"), nullable=False, index=True)
    bahan_baku_id: Mapped[int] = mapped_column(ForeignKey("bahan_baku.id"), nullable=False)
    qty_per_unit: Mapped[float] = mapped_column(
        Numeric(12, 6), nullable=False,
        comment="Jumlah bahan per 1 unit produk"
    )
    satuan: Mapped[str] = mapped_column(String(50), nullable=False)

    resep = relationship("Resep", back_populates="bahan_list")
    bahan_baku = relationship("BahanBaku", lazy="selectin")
