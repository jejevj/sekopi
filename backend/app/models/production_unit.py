import enum
from datetime import datetime, date, timezone

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.models.menu import KategoriSelisih


def _enum_values(enum_cls):
    return [e.value for e in enum_cls]


class StatusUnit(str, enum.Enum):
    READY            = "ready"             # Di gudang, siap dibawa
    ON_GEROBAK       = "on_gerobak"        # Sedang dibawa ke gerobak (belum terjual/belum kembali)
    DISPATCHED       = "dispatched"        # (legacy — jangan dipakai untuk flow baru)
    DELIVERED        = "delivered"         # (legacy)
    SOLD             = "sold"              # Terjual — keluar dari stok permanen
    RETURNED_GOOD    = "returned_good"     # Dikembalikan dalam kondisi baik — kembali ke READY
    RETURNED_DAMAGED = "returned_damaged"  # Dikembalikan rusak — keluar dari stok
    EXPIRED          = "expired"           # Kadaluarsa
    VOID             = "void"              # Di-void manual


class ProductionUnit(Base):
    __tablename__ = "production_units"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    barcode: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)

    mo_id: Mapped[int] = mapped_column(
        ForeignKey("manufacturing_orders.id"), nullable=False,
        comment="FK ke MO header — untuk traceability & grouping."
    )
    mo_line_id: Mapped[int] = mapped_column(
        ForeignKey("mo_lines.id"), nullable=False,
        comment="FK ke MOLine — menentukan menu & target_qty spesifik."
    )

    nama_produk: Mapped[str] = mapped_column(String(255), nullable=False)
    expiry_date: Mapped[date] = mapped_column(Date, nullable=False)
    harga_modal: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    harga_jual: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)

    status: Mapped[StatusUnit] = mapped_column(
        Enum(StatusUnit, values_callable=_enum_values),
        default=StatusUnit.READY,
        nullable=False,
    )

    # ── Lokasi saat ON_GEROBAK ───────────────────────────────────────────────
    # Diisi saat dispatch loading, di-clear saat return/sold
    loading_order_id: Mapped[int | None] = mapped_column(
        ForeignKey("loading_orders.id"), nullable=True, index=True,
        comment="Loading order yang sedang membawa unit ini. NULL jika di gudang."
    )
    current_gerobak_id: Mapped[int | None] = mapped_column(
        ForeignKey("gerobak.id"), nullable=True, index=True,
        comment="Gerobak yang sedang membawa unit ini. NULL jika di gudang."
    )
    current_driver_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True,
        comment="Driver yang sedang membawa unit ini. NULL jika di gudang."
    )
    # ────────────────────────────────────────────────────────────────────────

    # legacy — dipertahankan agar tidak break kode lama
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
    mo_line             = relationship("MOLine", lazy="selectin")
    pengiriman          = relationship("Pengiriman", lazy="selectin")
    loading_order       = relationship("LoadingOrder", foreign_keys=[loading_order_id], lazy="selectin")
    current_gerobak     = relationship("Gerobak", foreign_keys=[current_gerobak_id], lazy="selectin")
    current_driver      = relationship("User", foreign_keys=[current_driver_id], lazy="selectin")


class GenerateBatch(Base):
    """
    Merekam satu sesi generate unit dari sebuah MOLine.
    """
    __tablename__ = "generate_batch"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    mo_id: Mapped[int] = mapped_column(ForeignKey("manufacturing_orders.id"), nullable=False, index=True)
    mo_line_id: Mapped[int] = mapped_column(ForeignKey("mo_lines.id"), nullable=False, index=True)
    generated_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    jumlah_target: Mapped[int] = mapped_column(Integer, nullable=False)
    jumlah_aktual: Mapped[int] = mapped_column(Integer, nullable=False)
    selisih_qty: Mapped[int] = mapped_column(Integer, nullable=False)
    alasan_selisih: Mapped[str | None] = mapped_column(Text, nullable=True)
    kategori_selisih: Mapped[KategoriSelisih | None] = mapped_column(
        Enum(KategoriSelisih, values_callable=_enum_values), nullable=True
    )
    expiry_date: Mapped[date] = mapped_column(Date, nullable=False)
    harga_modal: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    harga_jual: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    manufacturing_order = relationship("ManufacturingOrder", lazy="selectin")
    mo_line             = relationship("MOLine", lazy="selectin")
    generated_by_user   = relationship("User", lazy="selectin")
