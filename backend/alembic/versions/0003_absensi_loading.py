"""0003 — tambah tabel absensi, loading_orders, loading_items

Revision ID: 0003_absensi_loading
Revises: 0002_menu_resep_selisih
Create Date: 2026-07-04
"""
from alembic import op
import sqlalchemy as sa

revision = "0003_absensi_loading"
down_revision = "0002_menu_resep_selisih"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── absensi ──────────────────────────────────────────────────────────
    op.create_table(
        "absensi",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tanggal", sa.Date, nullable=False),
        sa.Column(
            "status",
            sa.Enum("hadir", "izin", "sakit", "alpha", name="statusabsensi"),
            nullable=False,
            server_default="hadir",
        ),
        sa.Column("jam_masuk", sa.Time, nullable=True),
        sa.Column("jam_keluar", sa.Time, nullable=True),
        sa.Column("keterangan", sa.String(500), nullable=True),
        sa.Column("dicatat_oleh", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.UniqueConstraint("user_id", "tanggal", name="uq_absensi_user_tanggal"),
    )
    op.create_index("ix_absensi_tanggal", "absensi", ["tanggal"])
    op.create_index("ix_absensi_user_id", "absensi", ["user_id"])

    # ── loading_orders ───────────────────────────────────────────────────
    op.create_table(
        "loading_orders",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("nomor_loading", sa.String(50), unique=True, nullable=False),
        sa.Column("gerobak_id", sa.Integer, sa.ForeignKey("gerobak.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("driver_id", sa.Integer, sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("dibuat_oleh", sa.Integer, sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column(
            "status",
            sa.Enum("draft", "confirmed", "dispatched", "returned", name="statusloading"),
            nullable=False,
            server_default="draft",
        ),
        sa.Column("catatan", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index("ix_loading_orders_gerobak_id", "loading_orders", ["gerobak_id"])
    op.create_index("ix_loading_orders_nomor", "loading_orders", ["nomor_loading"])

    # ── loading_items ────────────────────────────────────────────────────
    op.create_table(
        "loading_items",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("loading_order_id", sa.Integer, sa.ForeignKey("loading_orders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("production_unit_id", sa.Integer, sa.ForeignKey("production_units.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("barcode_snapshot", sa.String(100), nullable=False),
        sa.Column("harga_modal_snapshot", sa.Numeric(12, 2), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_loading_items_loading_order_id", "loading_items", ["loading_order_id"])
    op.create_index("ix_loading_items_production_unit_id", "loading_items", ["production_unit_id"])


def downgrade() -> None:
    op.drop_table("loading_items")
    op.drop_table("loading_orders")
    op.drop_table("absensi")
    op.execute("DROP TYPE IF EXISTS statusloading")
    op.execute("DROP TYPE IF EXISTS statusabsensi")
