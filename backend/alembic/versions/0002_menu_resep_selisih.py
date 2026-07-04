"""feat: tambah tabel menu, resep, resep_bahan, generate_batch + kolom menu_id di mo + harga_jual di production_units

Revision ID: 0002_menu_resep_selisih
Revises: df0eda7995da
Create Date: 2026-07-04
"""
from alembic import op
import sqlalchemy as sa

revision = "0002_menu_resep_selisih"
down_revision = "df0eda7995da"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Tabel menu
    op.create_table(
        "menu",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("nama", sa.String(255), nullable=False, unique=True),
        sa.Column("deskripsi", sa.Text(), nullable=True),
        sa.Column("harga_jual", sa.Numeric(12, 2), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_menu_nama", "menu", ["nama"])

    # 2. Tabel resep
    op.create_table(
        "resep",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("menu_id", sa.Integer(), sa.ForeignKey("menu.id", ondelete="CASCADE"), nullable=False),
        sa.Column("nama_versi", sa.String(100), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("catatan", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_resep_menu_id", "resep", ["menu_id"])

    # 3. Tabel resep_bahan
    op.create_table(
        "resep_bahan",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("resep_id", sa.Integer(), sa.ForeignKey("resep.id", ondelete="CASCADE"), nullable=False),
        sa.Column("bahan_baku_id", sa.Integer(), sa.ForeignKey("bahan_baku.id"), nullable=False),
        sa.Column("qty_per_unit", sa.Numeric(12, 6), nullable=False),
        sa.Column("satuan", sa.String(50), nullable=False),
    )
    op.create_index("ix_resep_bahan_resep_id", "resep_bahan", ["resep_id"])

    # 4. Tambah kolom menu_id di manufacturing_orders (nullable, backward compat)
    op.add_column(
        "manufacturing_orders",
        sa.Column("menu_id", sa.Integer(), sa.ForeignKey("menu.id"), nullable=True)
    )
    op.create_index("ix_mo_menu_id", "manufacturing_orders", ["menu_id"])

    # 5. Tambah kolom harga_jual di production_units
    op.add_column(
        "production_units",
        sa.Column("harga_jual", sa.Numeric(12, 2), nullable=True,
                  comment="Harga jual per unit, diambil dari Menu saat generate")
    )

    # 6. Tabel generate_batch
    op.create_table(
        "generate_batch",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("mo_id", sa.Integer(), sa.ForeignKey("manufacturing_orders.id"), nullable=False),
        sa.Column("generated_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("jumlah_target", sa.Integer(), nullable=False),
        sa.Column("jumlah_aktual", sa.Integer(), nullable=False),
        sa.Column("selisih_qty", sa.Integer(), nullable=False),
        sa.Column("alasan_selisih", sa.Text(), nullable=True),
        sa.Column(
            "kategori_selisih",
            sa.Enum("human_error", "bahan", "alat", "lainnya", name="kategoriselisih"),
            nullable=True,
        ),
        sa.Column("expiry_date", sa.Date(), nullable=False),
        sa.Column("harga_modal", sa.Numeric(12, 2), nullable=True),
        sa.Column("harga_jual", sa.Numeric(12, 2), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_generate_batch_mo_id", "generate_batch", ["mo_id"])


def downgrade() -> None:
    op.drop_index("ix_generate_batch_mo_id", "generate_batch")
    op.drop_table("generate_batch")
    op.drop_column("production_units", "harga_jual")
    op.drop_index("ix_mo_menu_id", "manufacturing_orders")
    op.drop_column("manufacturing_orders", "menu_id")
    op.drop_index("ix_resep_bahan_resep_id", "resep_bahan")
    op.drop_table("resep_bahan")
    op.drop_index("ix_resep_menu_id", "resep")
    op.drop_table("resep")
    op.drop_index("ix_menu_nama", "menu")
    op.drop_table("menu")
    op.execute("DROP TYPE IF EXISTS kategoriselisih")
