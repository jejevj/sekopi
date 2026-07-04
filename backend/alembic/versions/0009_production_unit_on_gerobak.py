"""production_unit: tambah status ON_GEROBAK + kolom lokasi gerobak

Revision ID: 0009
Revises: 0008
Create Date: 2026-07-04

PostgreSQL mengharuskan ALTER TYPE ADD VALUE di-commit dalam transaksi
terpisah sebelum nilai baru bisa dipakai di statement lain.
Solusi: jalankan ALTER TYPE di dalam autocommit_block(), lalu
ADD COLUMN dan backfill UPDATE dijalankan setelah blok itu selesai.
"""
from alembic import op
import sqlalchemy as sa

revision = '0009'
down_revision = '0008'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Step 1: ALTER TYPE di transaksi AUTOCOMMIT tersendiri ──────────────
    # PostgreSQL tidak mengizinkan pemakaian nilai enum baru dalam transaksi
    # yang sama dengan ALTER TYPE ADD VALUE.
    # autocommit_block() commit transaksi aktif lalu jalankan DDL di luar tx.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE statusunit ADD VALUE IF NOT EXISTS 'on_gerobak'")

    # ── Step 2: Tambah kolom lokasi (transaksi normal) ─────────────────────
    op.add_column(
        'production_units',
        sa.Column(
            'loading_order_id',
            sa.Integer(),
            sa.ForeignKey('loading_orders.id', ondelete='SET NULL'),
            nullable=True,
            comment='Loading order yang sedang membawa unit ini. NULL jika di gudang.',
        ),
    )
    op.add_column(
        'production_units',
        sa.Column(
            'current_gerobak_id',
            sa.Integer(),
            sa.ForeignKey('gerobak.id', ondelete='SET NULL'),
            nullable=True,
            comment='Gerobak yang sedang membawa unit ini.',
        ),
    )
    op.add_column(
        'production_units',
        sa.Column(
            'current_driver_id',
            sa.Integer(),
            sa.ForeignKey('users.id', ondelete='SET NULL'),
            nullable=True,
            comment='Driver yang sedang membawa unit ini.',
        ),
    )

    op.create_index('ix_production_units_loading_order_id',   'production_units', ['loading_order_id'])
    op.create_index('ix_production_units_current_gerobak_id', 'production_units', ['current_gerobak_id'])
    op.create_index('ix_production_units_current_driver_id',  'production_units', ['current_driver_id'])

    # ── Step 3: Backfill legacy DISPATCHED → ON_GEROBAK ───────────────────
    # Nilai 'on_gerobak' sudah di-commit pada step 1, aman dipakai di sini.
    op.execute("""
        UPDATE production_units
        SET status = 'on_gerobak'
        WHERE status = 'dispatched'
    """)


def downgrade() -> None:
    op.drop_index('ix_production_units_current_driver_id',  table_name='production_units')
    op.drop_index('ix_production_units_current_gerobak_id', table_name='production_units')
    op.drop_index('ix_production_units_loading_order_id',   table_name='production_units')
    op.drop_column('production_units', 'current_driver_id')
    op.drop_column('production_units', 'current_gerobak_id')
    op.drop_column('production_units', 'loading_order_id')
    # Rollback backfill — kembalikan on_gerobak ke dispatched
    op.execute("""
        UPDATE production_units
        SET status = 'dispatched'
        WHERE status = 'on_gerobak'
    """)
    # Catatan: PostgreSQL tidak support DROP VALUE dari enum secara langsung.
    # Jika perlu benar-benar menghapus 'on_gerobak', harus recreate enum manual.
