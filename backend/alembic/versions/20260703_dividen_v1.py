"""add porsi_saham to shareholder_groups, gaji_karyawan, dividen_distribusi

Revision ID: 20260703_dividen_v1
Revises: 20260703_po_v1
Create Date: 2026-07-03
"""
from alembic import op
import sqlalchemy as sa

revision  = '20260703_dividen_v1'
down_revision = '20260703_po_v1'
branch_labels = None
depends_on    = None


def upgrade() -> None:
    # Tambah kolom porsi_saham ke shareholder_groups
    op.add_column(
        'shareholder_groups',
        sa.Column('porsi_saham', sa.Numeric(5, 2), nullable=False, server_default='0')
    )

    op.create_table(
        'gaji_karyawan',
        sa.Column('id',             sa.Integer, primary_key=True),
        sa.Column('periode_label',  sa.String(50), nullable=False),
        sa.Column('periode_dari',   sa.Date, nullable=False),
        sa.Column('periode_sampai', sa.Date, nullable=False),
        sa.Column('total_gaji',     sa.Numeric(14, 2), nullable=False),
        sa.Column('catatan',        sa.String(500), nullable=True),
        sa.Column('dibuat_oleh',    sa.Integer, sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at',     sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_gaji_periode', 'gaji_karyawan', ['periode_dari'])

    op.create_table(
        'dividen_distribusi',
        sa.Column('id',               sa.Integer, primary_key=True),
        sa.Column('group_id',         sa.Integer, sa.ForeignKey('shareholder_groups.id'), nullable=False),
        sa.Column('periode_label',    sa.String(50), nullable=False),
        sa.Column('periode_dari',     sa.Date, nullable=False),
        sa.Column('periode_sampai',   sa.Date, nullable=False),
        sa.Column('total_penjualan',  sa.Numeric(14, 2), nullable=False),
        sa.Column('total_pembelian',  sa.Numeric(14, 2), nullable=False),
        sa.Column('total_gaji_grup',  sa.Numeric(14, 2), nullable=False),
        sa.Column('laba_bersih_grup', sa.Numeric(14, 2), nullable=False),
        sa.Column('porsi_saham',      sa.Numeric(5, 2),  nullable=False),
        sa.Column('jumlah_dividen',   sa.Numeric(14, 2), nullable=False),
        sa.Column('status',           sa.String(20),     nullable=False, server_default='pending'),
        sa.Column('tanggal_bayar',    sa.Date, nullable=True),
        sa.Column('catatan',          sa.String(500), nullable=True),
        sa.Column('dibuat_oleh',      sa.Integer, sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at',       sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_dividen_group',   'dividen_distribusi', ['group_id'])
    op.create_index('ix_dividen_periode', 'dividen_distribusi', ['periode_dari'])


def downgrade() -> None:
    op.drop_index('ix_dividen_periode', 'dividen_distribusi')
    op.drop_index('ix_dividen_group',   'dividen_distribusi')
    op.drop_table('dividen_distribusi')
    op.drop_index('ix_gaji_periode', 'gaji_karyawan')
    op.drop_table('gaji_karyawan')
    op.drop_column('shareholder_groups', 'porsi_saham')
