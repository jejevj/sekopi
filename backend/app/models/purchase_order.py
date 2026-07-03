import enum
from datetime import date, datetime, timezone
from sqlalchemy import Date, DateTime, Enum, ForeignKey, Numeric, String, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base_class import Base


def _enum_values(e):
    return [x.value for x in e]


class StatusPO(str, enum.Enum):
    DRAFT        = "draft"
    DITERIMA     = "diterima"   # barang sudah masuk gudang
    LUNAS        = "lunas"      # sudah dibayar
    JATUH_TEMPO  = "jatuh_tempo"  # belum dibayar, melewati jatuh tempo


class MetodeBayar(str, enum.Enum):
    TUNAI    = "tunai"
    TEMPO    = "tempo"
    TRANSFER = "transfer"


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    nomor_po: Mapped[str] = mapped_column(String(50), nullable=False, unique=True, index=True)

    supplier_id: Mapped[int] = mapped_column(ForeignKey("suppliers.id"), nullable=False)
    dibuat_oleh: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    # Tanggal kunci
    tanggal_invoice: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    tanggal_jatuh_tempo: Mapped[date | None] = mapped_column(Date, nullable=True)
    tanggal_bayar: Mapped[date | None] = mapped_column(Date, nullable=True)

    metode_bayar: Mapped[MetodeBayar] = mapped_column(
        Enum(MetodeBayar, values_callable=_enum_values),
        default=MetodeBayar.TUNAI,
    )
    status: Mapped[StatusPO] = mapped_column(
        Enum(StatusPO, values_callable=_enum_values),
        default=StatusPO.DRAFT,
    )

    total_amount: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    catatan: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    supplier = relationship("Supplier", back_populates="purchase_orders", lazy="selectin")
    dibuat_user = relationship("User", foreign_keys=[dibuat_oleh], lazy="selectin")
    items = relationship("PurchaseOrderItem", back_populates="po", lazy="selectin", cascade="all, delete-orphan")


class PurchaseOrderItem(Base):
    __tablename__ = "purchase_order_items"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    po_id: Mapped[int] = mapped_column(ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False)
    bahan_baku_id: Mapped[int] = mapped_column(ForeignKey("bahan_baku.id"), nullable=False)

    jumlah: Mapped[float] = mapped_column(Numeric(10, 3), nullable=False)
    satuan: Mapped[str] = mapped_column(String(50), nullable=False)
    harga_satuan: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    subtotal: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)

    po = relationship("PurchaseOrder", back_populates="items")
    bahan_baku = relationship("BahanBaku", lazy="selectin")
