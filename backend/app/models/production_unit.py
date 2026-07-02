import enum
from datetime import datetime, date, timezone

from sqlalchemy import Date, DateTime, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


class StatusUnit(str, enum.Enum):
    READY = "ready"
    DISPATCHED = "dispatched"
    DELIVERED = "delivered"
    SOLD = "sold"
    RETURNED_GOOD = "returned_good"         # Kembali ke gudang, kondisi baik → bisa READY lagi
    RETURNED_DAMAGED = "returned_damaged"   # Kembali, diklaim rusak, menunggu konfirmasi
    EXPIRED = "expired"
    VOID = "void"


class ProductionUnit(Base):
    __tablename__ = "production_units"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    barcode: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    mo_id: Mapped[int] = mapped_column(ForeignKey("manufacturing_orders.id"), nullable=False)
    nama_produk: Mapped[str] = mapped_column(String(255), nullable=False)
    expiry_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[StatusUnit] = mapped_column(Enum(StatusUnit), default=StatusUnit.READY, nullable=False)
    pengiriman_id: Mapped[int | None] = mapped_column(ForeignKey("pengiriman.id"), nullable=True)
    dispatched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sold_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    returned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    voided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    void_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    manufacturing_order = relationship("ManufacturingOrder", lazy="selectin")
    pengiriman = relationship("Pengiriman", lazy="selectin")
