"""add loading_order_id to return_orders

Revision ID: a1b2c3d4e5f6
Revises: 
Create Date: 2026-07-04

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = None   # ganti dengan revision terakhir Anda
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'return_orders',
        sa.Column(
            'loading_order_id',
            sa.Integer(),
            sa.ForeignKey('loading_orders.id', ondelete='SET NULL'),
            nullable=True,
            index=True,
            comment='FK ke loading_orders — trip loading yang menjadi sumber retur ini.',
        ),
    )
    op.create_index(
        op.f('ix_return_orders_loading_order_id'),
        'return_orders',
        ['loading_order_id'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_return_orders_loading_order_id'), table_name='return_orders')
    op.drop_column('return_orders', 'loading_order_id')
