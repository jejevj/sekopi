import enum
from datetime import datetime, date, timezone

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Numeric, String, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


def _enum_values(enum_cls):
    return [e.value for e in enum_cls]


class StatusMO(str, enum.Enum):
    DRAFT       = "draft"
    CONFIRMED   = "confirmed"
    IN_PROGRESS = "in_progress"
    DONE        = "done"
    CANCELLED   = "cancelled"


class ManufacturingOrder(Base):
    __tablename__ = "manufacturing_orders"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    nomor_mo: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    nama_produk: Mapped[str] = mapped_column(String(255), nullable=False)
    target_qty: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    satuan: Mapped[str] = mapped_column(String(50), nullable=False)
    tanggal_rencana: Mapped[date] = mapped_column(Date, nullable=False)
    tanggal_mulai: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    tanggal_selesai: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[StatusMO] = mapped_column(
        Enum(StatusMO, values_callable=_enum_values),
        default=StatusMO.DRAFT,
        nullable=False,
    )
    catatan: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    approved_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    inventori_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    inventori_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    created_by_user = relationship("User", foreign_keys=[created_by], lazy="selectin")
    approved_by_user = relationship("User", foreign_keys=[approved_by], lazy="selectin")
    inventori_by_user = relationship("User", foreign_keys=[inventori_by], lazy="selectin")
    bahan_baku_lines = relationship("MOBahanBaku", back_populates="manufacturing_order", lazy="selectin")


class MOBahanBaku(Base):
    __tablename__ = "mo_bahan_baku"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    mo_id: Mapped[int] = mapped_column(ForeignKey("manufacturing_orders.id"), nullable=False)
    bahan_baku_id: Mapped[int] = mapped_column(ForeignKey("bahan_baku.id"), nullable=False)
    qty_rencana: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)  # total untuk seluruh MO
    qty_per_unit: Mapped[float | None] = mapped_column(Numeric(12, 6), nullable=True)  # qty bahan per 1 cup/unit produk
    qty_aktual: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    satuan: Mapped[str] = mapped_column(String(50), nullable=False)

    manufacturing_order = relationship("ManufacturingOrder", back_populates="bahan_baku_lines")
    bahan_baku = relationship("BahanBaku", lazy="selectin")
