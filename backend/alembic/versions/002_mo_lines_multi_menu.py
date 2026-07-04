"""
MO Multi-Menu: tambah tabel mo_lines, pindah kolom dari manufacturing_orders,
ubah FK mo_bahan_baku.mo_id → mo_line_id,
tambah mo_line_id ke production_units, generate_batch, return_items.

Revision ID: 002_mo_lines
Revises: 0002_menu_resep_selisih
Create Date: 2026-07-04
"""
from alembic import op
import sqlalchemy as sa

revision = "002_mo_lines"
down_revision = "0002_menu_resep_selisih"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # 1. Buat tabel mo_lines
    # ------------------------------------------------------------------
    op.create_table(
        "mo_lines",
        sa.Column("id",          sa.Integer(),     nullable=False),
        sa.Column("mo_id",       sa.Integer(),     nullable=False),
        sa.Column("menu_id",     sa.Integer(),     nullable=True),
        sa.Column("nama_produk", sa.String(255),   nullable=False),
        sa.Column("target_qty",  sa.Numeric(10,2), nullable=False),
        sa.Column("satuan",      sa.String(50),    nullable=False, server_default="unit"),
        sa.Column("created_at",  sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["mo_id"],   ["manufacturing_orders.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["menu_id"], ["menu.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_mo_lines_id",     "mo_lines", ["id"])
    op.create_index("ix_mo_lines_mo_id",  "mo_lines", ["mo_id"])
    op.create_index("ix_mo_lines_menu_id","mo_lines", ["menu_id"])

    # ------------------------------------------------------------------
    # 2. Migrasi data lama: buat 1 MOLine per MO yang sudah ada
    # ------------------------------------------------------------------
    op.execute("""
        INSERT INTO mo_lines (mo_id, menu_id, nama_produk, target_qty, satuan, created_at)
        SELECT id, menu_id, nama_produk, target_qty, satuan, created_at
        FROM   manufacturing_orders
    """)

    # ------------------------------------------------------------------
    # 3. mo_bahan_baku: tambah mo_line_id, isi dari mapping mo_id → mo_lines.id
    # ------------------------------------------------------------------
    op.add_column("mo_bahan_baku",
        sa.Column("mo_line_id", sa.Integer(), nullable=True)
    )
    op.execute("""
        UPDATE mo_bahan_baku mb
        SET    mo_line_id = ml.id
        FROM   mo_lines ml
        WHERE  ml.mo_id = mb.mo_id
    """)
    # Set NOT NULL setelah diisi
    op.alter_column("mo_bahan_baku", "mo_line_id", nullable=False)
    op.create_foreign_key(
        "fk_mo_bahan_baku_mo_line_id",
        "mo_bahan_baku", "mo_lines",
        ["mo_line_id"], ["id"], ondelete="CASCADE"
    )
    op.create_index("ix_mo_bahan_baku_mo_line_id", "mo_bahan_baku", ["mo_line_id"])
    # Drop kolom mo_id lama di mo_bahan_baku
    op.drop_column("mo_bahan_baku", "mo_id")

    # ------------------------------------------------------------------
    # 4. production_units: tambah mo_line_id
    # ------------------------------------------------------------------
    op.add_column("production_units",
        sa.Column("mo_line_id", sa.Integer(), nullable=True)
    )
    op.execute("""
        UPDATE production_units pu
        SET    mo_line_id = ml.id
        FROM   mo_lines ml
        WHERE  ml.mo_id = pu.mo_id
    """)
    op.alter_column("production_units", "mo_line_id", nullable=False)
    op.create_foreign_key(
        "fk_production_units_mo_line_id",
        "production_units", "mo_lines",
        ["mo_line_id"], ["id"]
    )

    # ------------------------------------------------------------------
    # 5. generate_batch: tambah mo_line_id
    # ------------------------------------------------------------------
    op.add_column("generate_batch",
        sa.Column("mo_line_id", sa.Integer(), nullable=True)
    )
    op.execute("""
        UPDATE generate_batch gb
        SET    mo_line_id = ml.id
        FROM   mo_lines ml
        WHERE  ml.mo_id = gb.mo_id
    """)
    op.alter_column("generate_batch", "mo_line_id", nullable=False)
    op.create_foreign_key(
        "fk_generate_batch_mo_line_id",
        "generate_batch", "mo_lines",
        ["mo_line_id"], ["id"]
    )
    op.create_index("ix_generate_batch_mo_line_id", "generate_batch", ["mo_line_id"])

    # ------------------------------------------------------------------
    # 6. return_items: tambah mo_line_id (nullable — backward compat)
    # ------------------------------------------------------------------
    op.add_column("return_items",
        sa.Column("mo_line_id", sa.Integer(), nullable=True)
    )
    op.execute("""
        UPDATE return_items ri
        SET    mo_line_id = pu.mo_line_id
        FROM   production_units pu
        WHERE  pu.id = ri.production_unit_id
    """)
    op.create_foreign_key(
        "fk_return_items_mo_line_id",
        "return_items", "mo_lines",
        ["mo_line_id"], ["id"]
    )

    # ------------------------------------------------------------------
    # 7. Hapus kolom lama dari manufacturing_orders (sudah pindah ke mo_lines)
    # ------------------------------------------------------------------
    op.drop_column("manufacturing_orders", "menu_id")
    op.drop_column("manufacturing_orders", "nama_produk")
    op.drop_column("manufacturing_orders", "target_qty")
    op.drop_column("manufacturing_orders", "satuan")


def downgrade() -> None:
    # ------------------------------------------------------------------
    # Kembalikan kolom ke manufacturing_orders
    # ------------------------------------------------------------------
    op.add_column("manufacturing_orders",
        sa.Column("menu_id",     sa.Integer(),     nullable=True))
    op.add_column("manufacturing_orders",
        sa.Column("nama_produk", sa.String(255),   nullable=True))
    op.add_column("manufacturing_orders",
        sa.Column("target_qty",  sa.Numeric(10,2), nullable=True))
    op.add_column("manufacturing_orders",
        sa.Column("satuan",      sa.String(50),    nullable=True))

    # Restore data dari mo_lines (hanya ambil line pertama per MO)
    op.execute("""
        UPDATE manufacturing_orders mo
        SET    menu_id     = ml.menu_id,
               nama_produk = ml.nama_produk,
               target_qty  = ml.target_qty,
               satuan      = ml.satuan
        FROM   (
            SELECT DISTINCT ON (mo_id) mo_id, menu_id, nama_produk, target_qty, satuan
            FROM   mo_lines
            ORDER  BY mo_id, id
        ) ml
        WHERE  mo.id = ml.mo_id
    """)

    # Kembalikan mo_id ke mo_bahan_baku
    op.add_column("mo_bahan_baku",
        sa.Column("mo_id", sa.Integer(), nullable=True))
    op.execute("""
        UPDATE mo_bahan_baku mb
        SET    mo_id = ml.mo_id
        FROM   mo_lines ml
        WHERE  ml.id = mb.mo_line_id
    """)
    op.alter_column("mo_bahan_baku", "mo_id", nullable=False)
    op.drop_constraint("fk_mo_bahan_baku_mo_line_id", "mo_bahan_baku", type_="foreignkey")
    op.drop_index("ix_mo_bahan_baku_mo_line_id", "mo_bahan_baku")
    op.drop_column("mo_bahan_baku", "mo_line_id")

    # Drop kolom mo_line_id dari tabel lain
    op.drop_constraint("fk_production_units_mo_line_id", "production_units", type_="foreignkey")
    op.drop_column("production_units", "mo_line_id")

    op.drop_constraint("fk_generate_batch_mo_line_id", "generate_batch", type_="foreignkey")
    op.drop_index("ix_generate_batch_mo_line_id", "generate_batch")
    op.drop_column("generate_batch", "mo_line_id")

    op.drop_constraint("fk_return_items_mo_line_id", "return_items", type_="foreignkey")
    op.drop_column("return_items", "mo_line_id")

    # Drop tabel mo_lines
    op.drop_index("ix_mo_lines_menu_id", "mo_lines")
    op.drop_index("ix_mo_lines_mo_id",   "mo_lines")
    op.drop_index("ix_mo_lines_id",      "mo_lines")
    op.drop_table("mo_lines")
