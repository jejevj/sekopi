from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Table, Column
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


# Many-to-many: shareholder_group <-> users
shareholder_group_members = Table(
    "shareholder_group_members",
    Base.metadata,
    Column("group_id", Integer, ForeignKey("shareholder_groups.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
)


class ShareholderGroup(Base):
    __tablename__ = "shareholder_groups"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    nama: Mapped[str] = mapped_column(String(255), nullable=False)
    deskripsi: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # Porsi saham grup ini (0.00 – 100.00). Total semua grup <= 100.
    porsi_saham: Mapped[float] = mapped_column(Numeric(5, 2), default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    members  = relationship("User", secondary=shareholder_group_members, lazy="selectin")
    gerobaks = relationship("Gerobak", back_populates="shareholder_group", lazy="selectin")


class Gerobak(Base):
    __tablename__ = "gerobak"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    nama: Mapped[str] = mapped_column(String(255), nullable=False)
    kode: Mapped[str] = mapped_column(String(50), nullable=False, unique=True, index=True)
    lokasi: Mapped[str | None] = mapped_column(String(255), nullable=True)
    driver_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    shareholder_group_id: Mapped[int | None] = mapped_column(
        ForeignKey("shareholder_groups.id"), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    driver            = relationship("User", foreign_keys=[driver_id], lazy="selectin")
    shareholder_group = relationship("ShareholderGroup", back_populates="gerobaks", lazy="selectin")
