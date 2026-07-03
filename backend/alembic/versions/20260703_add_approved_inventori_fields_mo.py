"""add approved_by and inventori_by fields to manufacturing_orders

Revision ID: 20260703_mo_approval
Revises: 794712529f56
Create Date: 2026-07-03
"""
from alembic import op
import sqlalchemy as sa

revision = '20260703_mo_approval'
down_revision = '794712529f56'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('manufacturing_orders',
        sa.Column('approved_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True)
    )
    op.add_column('manufacturing_orders',
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column('manufacturing_orders',
        sa.Column('inventori_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True)
    )
    op.add_column('manufacturing_orders',
        sa.Column('inventori_at', sa.DateTime(timezone=True), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('manufacturing_orders', 'inventori_at')
    op.drop_column('manufacturing_orders', 'inventori_by')
    op.drop_column('manufacturing_orders', 'approved_at')
    op.drop_column('manufacturing_orders', 'approved_by')
