"""add suppliers, purchase_orders, purchase_order_items

Revision ID: 20260703_po_v1
Revises: 20260703_gerobak_v1
Create Date: 2026-07-03
"""
from alembic import op
import sqlalchemy as sa

revision = '20260703_po_v1'
down_revision = '20260703_gerobak_v1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'suppliers',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('nama', sa.String(255), nullable=False),
        sa.Column('kontak', sa.String(255), nullable=True),
        sa.Column('telepon', sa.String(50), nullable=True),
        sa.Column('email', sa.String(255), nullable=True),
        sa.Column('alamat', sa.String(500), nullable=True),
        sa.Column('catatan', sa.String(500), nullable=True),
        sa.Column('is_active', sa.Boolean, default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        'purchase_orders',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('nomor_po', sa.String(50), nullable=False, unique=True),
        sa.Column('supplier_id', sa.Integer, sa.ForeignKey('suppliers.id'), nullable=False),
        sa.Column('dibuat_oleh', sa.Integer, sa.ForeignKey('users.id'), nullable=False),
        sa.Column('tanggal_invoice', sa.Date, nullable=False),
        sa.Column('tanggal_jatuh_tempo', sa.Date, nullable=True),
        sa.Column('tanggal_bayar', sa.Date, nullable=True),
        sa.Column('metode_bayar', sa.String(20), nullable=False, server_default='tunai'),
        sa.Column('status', sa.String(20), nullable=False, server_default='draft'),
        sa.Column('total_amount', sa.Numeric(14, 2), default=0),
        sa.Column('catatan', sa.String(1000), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_po_tanggal_invoice', 'purchase_orders', ['tanggal_invoice'])
    op.create_index('ix_po_nomor', 'purchase_orders', ['nomor_po'])
    op.create_table(
        'purchase_order_items',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('po_id', sa.Integer, sa.ForeignKey('purchase_orders.id', ondelete='CASCADE'), nullable=False),
        sa.Column('bahan_baku_id', sa.Integer, sa.ForeignKey('bahan_baku.id'), nullable=False),
        sa.Column('jumlah', sa.Numeric(10, 3), nullable=False),
        sa.Column('satuan', sa.String(50), nullable=False),
        sa.Column('harga_satuan', sa.Numeric(14, 2), nullable=False),
        sa.Column('subtotal', sa.Numeric(14, 2), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('purchase_order_items')
    op.drop_index('ix_po_nomor', 'purchase_orders')
    op.drop_index('ix_po_tanggal_invoice', 'purchase_orders')
    op.drop_table('purchase_orders')
    op.drop_table('suppliers')
