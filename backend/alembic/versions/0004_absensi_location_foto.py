"""0004 — tambah kolom lokasi+foto di absensi, tabel absensi_settings

Revision ID: 0004_absensi_location_foto
Revises: 0003_absensi_loading
Create Date: 2026-07-04
"""
from alembic import op
import sqlalchemy as sa

revision = "0004_absensi_location_foto"
down_revision = "0003_absensi_loading"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. Kolom baru di tabel absensi ────────────────────────────────────────────
    op.add_column("absensi", sa.Column("latitude",     sa.Numeric(10, 7), nullable=True))
    op.add_column("absensi", sa.Column("longitude",    sa.Numeric(10, 7), nullable=True))
    op.add_column("absensi", sa.Column("jarak_meter",  sa.Numeric(8, 2),  nullable=True))
    op.add_column("absensi", sa.Column("dalam_radius", sa.Boolean,         nullable=True))
    op.add_column("absensi", sa.Column("foto_url",     sa.String(500),     nullable=True))

    # ── 2. Tabel absensi_settings ──────────────────────────────────────────────
    op.create_table(
        "absensi_settings",
        sa.Column("id",           sa.Integer,            primary_key=True, autoincrement=True),
        sa.Column("nama_lokasi",  sa.String(255),         nullable=False),
        sa.Column("latitude",     sa.Numeric(10, 7),      nullable=False),
        sa.Column("longitude",    sa.Numeric(10, 7),      nullable=False),
        sa.Column("radius_meter", sa.Integer,             nullable=False, server_default="100"),
        sa.Column("is_active",    sa.Boolean,             nullable=False, server_default=sa.text("true")),
        sa.Column("created_at",   sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at",   sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("absensi_settings")
    op.drop_column("absensi", "foto_url")
    op.drop_column("absensi", "dalam_radius")
    op.drop_column("absensi", "jarak_meter")
    op.drop_column("absensi", "longitude")
    op.drop_column("absensi", "latitude")
