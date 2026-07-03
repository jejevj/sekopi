"""add harga_beli qty_per_unit

Revision ID: df0eda7995da
Revises: 20260703_pengeluaran_fix
Create Date: 2026-07-03 14:07:31.198275

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'df0eda7995da'
down_revision: Union[str, None] = '20260703_pengeluaran_fix'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # === KOLOM BARU ===
    op.add_column('bahan_baku', sa.Column('harga_beli_per_satuan', sa.Numeric(precision=14, scale=2), nullable=True))
    op.add_column('mo_bahan_baku', sa.Column('qty_per_unit', sa.Numeric(precision=12, scale=6), nullable=True))

    # === INDEX & CONSTRAINT CLEANUP ===
    op.alter_column('bahan_baku', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=False)
    op.alter_column('dividen_distribusi', 'user_id',
               existing_type=sa.INTEGER(),
               nullable=False)
    op.alter_column('dividen_distribusi', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=False)
    op.drop_index('ix_dividen_group', table_name='dividen_distribusi')
    op.drop_index('ix_dividen_periode', table_name='dividen_distribusi')
    op.drop_index('ix_dividen_user', table_name='dividen_distribusi')
    op.create_index(op.f('ix_dividen_distribusi_group_id'), 'dividen_distribusi', ['group_id'], unique=False)
    op.create_index(op.f('ix_dividen_distribusi_id'), 'dividen_distribusi', ['id'], unique=False)
    op.drop_column('dividen_distribusi', 'user_nama')
    op.alter_column('gaji_karyawan', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=False)
    op.drop_index('ix_gaji_periode', table_name='gaji_karyawan')
    op.create_index(op.f('ix_gaji_karyawan_id'), 'gaji_karyawan', ['id'], unique=False)
    op.create_index(op.f('ix_gaji_karyawan_periode_dari'), 'gaji_karyawan', ['periode_dari'], unique=False)
    op.alter_column('gerobak', 'is_active',
               existing_type=sa.BOOLEAN(),
               nullable=False)
    op.alter_column('gerobak', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=False)
    op.alter_column('gerobak', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=False)
    op.drop_constraint('gerobak_kode_key', 'gerobak', type_='unique')
    op.create_index(op.f('ix_gerobak_id'), 'gerobak', ['id'], unique=False)
    op.create_index(op.f('ix_gerobak_kode'), 'gerobak', ['kode'], unique=True)
    op.alter_column('pengeluaran', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=False)
    op.create_index(op.f('ix_purchase_order_items_id'), 'purchase_order_items', ['id'], unique=False)
    # NOTE: alter metode_bayar & status ke Enum dihapus — enum belum exist di DB
    op.alter_column('purchase_orders', 'total_amount',
               existing_type=sa.NUMERIC(precision=14, scale=2),
               nullable=False)
    op.alter_column('purchase_orders', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=False)
    op.alter_column('purchase_orders', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=False)
    op.drop_index('ix_po_nomor', table_name='purchase_orders')
    op.drop_index('ix_po_tanggal_invoice', table_name='purchase_orders')
    op.drop_constraint('purchase_orders_nomor_po_key', 'purchase_orders', type_='unique')
    op.create_index(op.f('ix_purchase_orders_id'), 'purchase_orders', ['id'], unique=False)
    op.create_index(op.f('ix_purchase_orders_nomor_po'), 'purchase_orders', ['nomor_po'], unique=True)
    op.create_index(op.f('ix_purchase_orders_tanggal_invoice'), 'purchase_orders', ['tanggal_invoice'], unique=False)
    op.create_unique_constraint('uq_group_member', 'shareholder_group_members', ['group_id', 'user_id'])
    op.alter_column('shareholder_groups', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=False)
    op.create_index(op.f('ix_shareholder_groups_id'), 'shareholder_groups', ['id'], unique=False)
    op.alter_column('suppliers', 'is_active',
               existing_type=sa.BOOLEAN(),
               nullable=False)
    op.alter_column('suppliers', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=False)
    op.alter_column('suppliers', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=False)
    op.create_index(op.f('ix_suppliers_id'), 'suppliers', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_suppliers_id'), table_name='suppliers')
    op.alter_column('suppliers', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True)
    op.alter_column('suppliers', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True)
    op.alter_column('suppliers', 'is_active',
               existing_type=sa.BOOLEAN(),
               nullable=True)
    op.drop_index(op.f('ix_shareholder_groups_id'), table_name='shareholder_groups')
    op.alter_column('shareholder_groups', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True)
    op.drop_constraint('uq_group_member', 'shareholder_group_members', type_='unique')
    op.drop_index(op.f('ix_purchase_orders_tanggal_invoice'), table_name='purchase_orders')
    op.drop_index(op.f('ix_purchase_orders_nomor_po'), table_name='purchase_orders')
    op.drop_index(op.f('ix_purchase_orders_id'), table_name='purchase_orders')
    op.create_unique_constraint('purchase_orders_nomor_po_key', 'purchase_orders', ['nomor_po'])
    op.create_index('ix_po_tanggal_invoice', 'purchase_orders', ['tanggal_invoice'], unique=False)
    op.create_index('ix_po_nomor', 'purchase_orders', ['nomor_po'], unique=False)
    op.alter_column('purchase_orders', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True)
    op.alter_column('purchase_orders', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True)
    op.alter_column('purchase_orders', 'total_amount',
               existing_type=sa.NUMERIC(precision=14, scale=2),
               nullable=True)
    op.drop_index(op.f('ix_purchase_order_items_id'), table_name='purchase_order_items')
    op.alter_column('pengeluaran', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True)
    op.drop_index(op.f('ix_gerobak_kode'), table_name='gerobak')
    op.drop_index(op.f('ix_gerobak_id'), table_name='gerobak')
    op.create_unique_constraint('gerobak_kode_key', 'gerobak', ['kode'])
    op.alter_column('gerobak', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True)
    op.alter_column('gerobak', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True)
    op.alter_column('gerobak', 'is_active',
               existing_type=sa.BOOLEAN(),
               nullable=True)
    op.drop_index(op.f('ix_gaji_karyawan_periode_dari'), table_name='gaji_karyawan')
    op.drop_index(op.f('ix_gaji_karyawan_id'), table_name='gaji_karyawan')
    op.create_index('ix_gaji_periode', 'gaji_karyawan', ['periode_dari'], unique=False)
    op.alter_column('gaji_karyawan', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True)
    op.add_column('dividen_distribusi', sa.Column('user_nama', sa.VARCHAR(length=200), autoincrement=False, nullable=True))
    op.drop_index(op.f('ix_dividen_distribusi_id'), table_name='dividen_distribusi')
    op.drop_index(op.f('ix_dividen_distribusi_group_id'), table_name='dividen_distribusi')
    op.create_index('ix_dividen_user', 'dividen_distribusi', ['user_id'], unique=False)
    op.create_index('ix_dividen_periode', 'dividen_distribusi', ['periode_dari'], unique=False)
    op.create_index('ix_dividen_group', 'dividen_distribusi', ['group_id'], unique=False)
    op.alter_column('dividen_distribusi', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True)
    op.alter_column('dividen_distribusi', 'user_id',
               existing_type=sa.INTEGER(),
               nullable=True)
    op.alter_column('bahan_baku', 'updated_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               nullable=True)
    op.drop_column('mo_bahan_baku', 'qty_per_unit')
    op.drop_column('bahan_baku', 'harga_beli_per_satuan')
