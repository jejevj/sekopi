import enum
from datetime import datetime, date, timezone

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.models.menu import KategoriSelisih


def _enum_values(enum_cls):
    return [e.value for e in enum_cls]


class StatusUnit(str, enum.Enum):
    READY            = "ready"
    DISPATCHED       = "dispatched"
    DELIVERED        = "delivered"
    SOLD             = "sold"
    RETURNED_GOOD    = "returned_good"
    RETURNED_DAMAGED = "returned_damaged"
    EXPIRED          = "expired"
    VOID             = "void"


class ProductionUnit(Base):
    __tablename__ = "production_units"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    barcode: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)

    # Referensi ke MO header (untuk traceability level MO)
    mo_id: Mapped[int] = mapped_column(
        ForeignKey("manufacturing_orders.id"), nullable=False,
        comment="FK ke MO header — untuk traceability & grouping."
    )
    # Referensi ke MOLine (untuk tahu unit ini produk/menu yang mana)
    mo_line_id: Mapped[int] = mapped_column(
        ForeignKey("mo_lines.id"), nullable=False,
        comment="FK ke MOLine — menentukan menu & target_qty spesifik."
    )

    nama_produk: Mapped[str] = mapped_column(String(255), nullable=False)
    expiry_date: Mapped[date] = mapped_column(Date, nullable=False)
    harga_modal: Mapped[float | None] = mapped_column(
        Numeric(12, 2), nullable=True,
        comment="Harga modal per unit, diisi tim produksi."
    )
    harga_jual: Mapped[float | None] = mapped_column(
        Numeric(12, 2), nullable=True,
        comment="Harga jual per unit, diambil otomatis dari Menu saat generate."
    )
    status: Mapped[StatusUnit] = mapped_column(
        Enum(StatusUnit, values_callable=_enum_values),
        default=StatusUnit.READY,
        nullable=False,
    )
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


class GenerateBatch(Base):
    """
    Merekam satu sesi generate unit dari sebuah MOLine.
    """
    __tablename__ = "generate_batch"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    # Tetap simpan mo_id untuk grouping / laporan per MO
    mo_id: Mapped[int] = mapped_column(
        ForeignKey("manufacturing_orders.id"), nullable=False, index=True,
        comment="FK ke MO header."
    )
    # mo_line_id menentukan produk mana yang di-generate dalam batch ini
    mo_line_id: Mapped[int] = mapped_column(
        ForeignKey("mo_lines.id"), nullable=False, index=True,
        comment="FK ke MOLine — produk spesifik yang di-generate."
    )
    generated_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    jumlah_target: Mapped[int] = mapped_column(
        Integer, nullable=False,
        comment="target_qty dari MOLine saat generate dilakukan"
    )
    jumlah_aktual: Mapped[int] = mapped_column(
        Integer, nullable=False,
        comment="Jumlah unit yang benar-benar di-generate"
    )
    selisih_qty: Mapped[int] = mapped_column(
        Integer, nullable=False,
        comment="aktual - target. Negatif = kurang, positif = lebih"
    )
    alasan_selisih: Mapped[str | None] = mapped_column(
        Text, nullable=True,
        comment="Wajib diisi jika selisih_qty != 0"
    )
    kategori_selisih: Mapped[KategoriSelisih | None] = mapped_column(
        Enum(KategoriSelisih, values_callable=_enum_values),
        nullable=True,
        comment="Kategori penyebab selisih"
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
