import enum
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


def _enum_values(enum_cls):
    return [e.value for e in enum_cls]


class StatusReturnOrder(str, enum.Enum):
    DRAFT     = "draft"
    SUBMITTED = "submitted"
    REVIEWED  = "reviewed"


class KategoriReturn(str, enum.Enum):
    SISA  = "sisa"
    RUSAK = "rusak"


class KondisiKonfirmasi(str, enum.Enum):
    PENDING           = "pending"
    BAIK              = "baik"
    RUSAK_KONFIRMASI  = "rusak_konfirmasi"


class ReturnOrder(Base):
    __tablename__ = "return_orders"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    nomor_return: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    pengiriman_id: Mapped[int] = mapped_column(ForeignKey("pengiriman.id"), nullable=False)
    driver_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    status: Mapped[StatusReturnOrder] = mapped_column(
        Enum(StatusReturnOrder, values_callable=_enum_values),
        default=StatusReturnOrder.DRAFT,
        nullable=False,
    )
    catatan_driver: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    reviewed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    catatan_reviewer: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    pengiriman = relationship("Pengiriman", lazy="selectin")
    driver = relationship("User", foreign_keys=[driver_id], lazy="selectin")
    reviewer = relationship("User", foreign_keys=[reviewed_by], lazy="selectin")
    items = relationship("ReturnItem", back_populates="return_order", lazy="selectin")


class ReturnItem(Base):
    __tablename__ = "return_items"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    return_order_id: Mapped[int] = mapped_column(ForeignKey("return_orders.id"), nullable=False)
    production_unit_id: Mapped[int] = mapped_column(ForeignKey("production_units.id"), nullable=False)
    barcode: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    mo_id: Mapped[int] = mapped_column(ForeignKey("manufacturing_orders.id"), nullable=False)
    kategori: Mapped[KategoriReturn] = mapped_column(
        Enum(KategoriReturn, values_callable=_enum_values), nullable=False
    )
    kondisi_konfirmasi: Mapped[KondisiKonfirmasi] = mapped_column(
        Enum(KondisiKonfirmasi, values_callable=_enum_values),
        default=KondisiKonfirmasi.PENDING,
        nullable=False,
    )
    catatan_driver: Mapped[str | None] = mapped_column(String(500), nullable=True)
    catatan_reviewer: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    return_order = relationship("ReturnOrder", back_populates="items")
    production_unit = relationship("ProductionUnit", lazy="selectin")
    manufacturing_order = relationship("ManufacturingOrder", lazy="selectin")
