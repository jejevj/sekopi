"""production_unit: tambah status ON_GEROBAK + kolom lokasi gerobak

Revision ID: 0009
Revises: 0008
Create Date: 2026-07-04

Perubahan:
  1. Tambah nilai 'on_gerobak' ke enum statusunit
  2. Tambah kolom loading_order_id, current_gerobak_id, current_driver_id
     ke tabel production_units

Logika stok setelah migrasi ini:
  READY         = ada di gudang, terhitung sebagai stok
  ON_GEROBAK    = sedang dibawa driver, TIDAK mengurangi stok gudang secara
                  akuntansi — hanya berpindah lokasi, belum terjual
  SOLD          = terjual, keluar dari stok permanen
  RETURNED_GOOD = dikembalikan baik → kembali ke READY (masuk stok lagi)
  RETURNED_DAMAGED = dikembalikan rusak → keluar stok permanen
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0009'
down_revision = '0008'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Tambah nilai baru ke enum statusunit
    #    Gunakan raw SQL karena ALTER TYPE hanya didukung PostgreSQL
    op.execute("ALTER TYPE statusunit ADD VALUE IF NOT EXISTS 'on_gerobak'")

    # 2. Tambah kolom lokasi ke production_units
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

    op.create_index('ix_production_units_loading_order_id',  'production_units', ['loading_order_id'])
    op.create_index('ix_production_units_current_gerobak_id', 'production_units', ['current_gerobak_id'])
    op.create_index('ix_production_units_current_driver_id',  'production_units', ['current_driver_id'])

    # 3. Backfill: unit yang masih DISPATCHED (legacy) → ON_GEROBAK
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
    # Rollback backfill
    op.execute("""
        UPDATE production_units
        SET status = 'dispatched'
        WHERE status = 'on_gerobak'
    """)
    # Catatan: PostgreSQL tidak support DROP VALUE dari enum,
    # perlu recreate enum jika benar-benar perlu remove 'on_gerobak'
