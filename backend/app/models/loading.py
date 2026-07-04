import enum
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


def _enum_values(e):
    return [x.value for x in e]


class StatusLoading(str, enum.Enum):
    DRAFT      = "draft"       # loading sedang disiapkan
    CONFIRMED  = "confirmed"   # sudah dikonfirmasi admin
    DISPATCHED = "dispatched"  # unit sudah dibawa ke gerobak
    RETURNED   = "returned"    # unit sisa dikembalikan


class LoadingOrder(Base):
    """Header loading — satu sesi pengisian gerobak."""
    __tablename__ = "loading_orders"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    nomor_loading: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)

    gerobak_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("gerobak.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    driver_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    dibuat_oleh: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )

    status: Mapped[StatusLoading] = mapped_column(
        Enum(StatusLoading, values_callable=_enum_values),
        nullable=False,
        default=StatusLoading.DRAFT,
    )

    catatan: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # relationships — gunakan selectin agar kompatibel dengan AsyncSession
    gerobak = relationship("Gerobak", foreign_keys=[gerobak_id], lazy="selectin")  # type: ignore
    driver = relationship("User", foreign_keys=[driver_id], lazy="selectin")  # type: ignore
    pembuat = relationship("User", foreign_keys=[dibuat_oleh], lazy="selectin")  # type: ignore
    items: Mapped[list["LoadingItem"]] = relationship(
        "LoadingItem", back_populates="loading_order", cascade="all, delete-orphan", lazy="selectin"
    )


class LoadingItem(Base):
    """Setiap baris = satu production unit yang di-scan masuk ke loading."""
    __tablename__ = "loading_items"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    loading_order_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("loading_orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    production_unit_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("production_units.id", ondelete="RESTRICT"), nullable=False, index=True
    )

    # snapshot saat loading — untuk audit jika unit berubah status setelah itu
    barcode_snapshot: Mapped[str] = mapped_column(String(100), nullable=False)
    harga_modal_snapshot: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    loading_order: Mapped["LoadingOrder"] = relationship("LoadingOrder", back_populates="items")
    production_unit = relationship("ProductionUnit", foreign_keys=[production_unit_id], lazy="selectin")  # type: ignore
