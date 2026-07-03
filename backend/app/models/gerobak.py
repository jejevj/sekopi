from datetime import datetime, timezone
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base_class import Base


class GroupMembership(Base):
    """
    Association object: shareholder_group <-> user dengan porsi saham per-user per-grup.
    porsi_saham dalam grup ini (0.00 – 100.00). Total semua anggota dalam satu grup harus <= 100.
    """
    __tablename__ = "shareholder_group_members"
    __table_args__ = (
        UniqueConstraint("group_id", "user_id", name="uq_group_member"),
    )

    group_id:    Mapped[int]   = mapped_column(ForeignKey("shareholder_groups.id", ondelete="CASCADE"), primary_key=True)
    user_id:     Mapped[int]   = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    porsi_saham: Mapped[float] = mapped_column(Numeric(5, 2), default=0, nullable=False)

    group = relationship("ShareholderGroup", back_populates="memberships", lazy="selectin")
    user  = relationship("User", lazy="selectin")


class ShareholderGroup(Base):
    __tablename__ = "shareholder_groups"

    id:          Mapped[int]       = mapped_column(primary_key=True, index=True)
    nama:        Mapped[str]       = mapped_column(String(255), nullable=False)
    deskripsi:   Mapped[str|None]  = mapped_column(String(500), nullable=True)
    created_at:  Mapped[datetime]  = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    memberships = relationship("GroupMembership", back_populates="group", lazy="selectin", cascade="all, delete-orphan")
    gerobaks    = relationship("Gerobak", back_populates="shareholder_group", lazy="selectin")

    @property
    def members(self):
        """Backward-compat: list of user objects"""
        return [m.user for m in self.memberships]


class Gerobak(Base):
    __tablename__ = "gerobak"

    id:                    Mapped[int]       = mapped_column(primary_key=True, index=True)
    nama:                  Mapped[str]       = mapped_column(String(255), nullable=False)
    kode:                  Mapped[str]       = mapped_column(String(50), nullable=False, unique=True, index=True)
    lokasi:                Mapped[str|None]  = mapped_column(String(255), nullable=True)
    driver_id:             Mapped[int|None]  = mapped_column(ForeignKey("users.id"), nullable=True)
    shareholder_group_id:  Mapped[int|None]  = mapped_column(ForeignKey("shareholder_groups.id"), nullable=True)
    is_active:             Mapped[bool]      = mapped_column(Boolean, default=True)
    created_at:            Mapped[datetime]  = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at:            Mapped[datetime]  = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    driver            = relationship("User", foreign_keys=[driver_id], lazy="selectin")
    shareholder_group = relationship("ShareholderGroup", back_populates="gerobaks", lazy="selectin")
