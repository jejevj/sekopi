"""add gerobak, shareholder_groups, shareholder_group_members; add gerobak_id to penjualan & pengiriman

Revision ID: 20260703_gerobak_v1
Revises: 20260703_bahan_baku_v2
Create Date: 2026-07-03
"""
from alembic import op
import sqlalchemy as sa

revision = '20260703_gerobak_v1'
down_revision = '20260703_bahan_baku_v2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'shareholder_groups',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('nama', sa.String(255), nullable=False),
        sa.Column('deskripsi', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        'gerobak',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('nama', sa.String(255), nullable=False),
        sa.Column('kode', sa.String(50), nullable=False, unique=True),
        sa.Column('lokasi', sa.String(255), nullable=True),
        sa.Column('driver_id', sa.Integer, sa.ForeignKey('users.id'), nullable=True),
        sa.Column('shareholder_group_id', sa.Integer, sa.ForeignKey('shareholder_groups.id'), nullable=True),
        sa.Column('is_active', sa.Boolean, default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        'shareholder_group_members',
        sa.Column('group_id', sa.Integer, sa.ForeignKey('shareholder_groups.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('user_id', sa.Integer, sa.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
    )
    op.add_column('penjualan', sa.Column('gerobak_id', sa.Integer, sa.ForeignKey('gerobak.id'), nullable=True))
    op.create_index('ix_penjualan_gerobak_id', 'penjualan', ['gerobak_id'])
    op.add_column('pengiriman', sa.Column('gerobak_id', sa.Integer, sa.ForeignKey('gerobak.id'), nullable=True))
    op.create_index('ix_pengiriman_gerobak_id', 'pengiriman', ['gerobak_id'])


def downgrade() -> None:
    op.drop_index('ix_pengiriman_gerobak_id', 'pengiriman')
    op.drop_column('pengiriman', 'gerobak_id')
    op.drop_index('ix_penjualan_gerobak_id', 'penjualan')
    op.drop_column('penjualan', 'gerobak_id')
    op.drop_table('shareholder_group_members')
    op.drop_table('gerobak')
    op.drop_table('shareholder_groups')
