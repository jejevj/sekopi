"""remove pengiriman_id from return_orders, make loading_order_id NOT NULL

Revision ID: 0008
Revises: 0007
Create Date: 2026-07-04
"""
from alembic import op
import sqlalchemy as sa

revision = '0008'
down_revision = '0007'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Hapus FK dan kolom pengiriman_id
    op.drop_constraint('return_orders_pengiriman_id_fkey', 'return_orders', type_='foreignkey')
    op.drop_column('return_orders', 'pengiriman_id')

    # loading_order_id yang tadinya nullable → NOT NULL
    # (pastikan tidak ada row dengan loading_order_id NULL sebelum migrasi ini)
    op.alter_column('return_orders', 'loading_order_id', nullable=False)

    # Ganti FK loading_order_id dari SET NULL → RESTRICT
    op.drop_constraint('return_orders_loading_order_id_fkey', 'return_orders', type_='foreignkey')
    op.create_foreign_key(
        'return_orders_loading_order_id_fkey',
        'return_orders', 'loading_orders',
        ['loading_order_id'], ['id'],
        ondelete='RESTRICT',
    )


def downgrade() -> None:
    op.drop_constraint('return_orders_loading_order_id_fkey', 'return_orders', type_='foreignkey')
    op.create_foreign_key(
        'return_orders_loading_order_id_fkey',
        'return_orders', 'loading_orders',
        ['loading_order_id'], ['id'],
        ondelete='SET NULL',
    )
    op.alter_column('return_orders', 'loading_order_id', nullable=True)
    op.add_column('return_orders', sa.Column('pengiriman_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'return_orders_pengiriman_id_fkey',
        'return_orders', 'pengiriman',
        ['pengiriman_id'], ['id'],
    )
