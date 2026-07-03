"""add satuan_display, konversi_factor, updated_at to bahan_baku

Revision ID: 20260703_bahan_baku_v2
Revises: 20260703_mo_approval
Create Date: 2026-07-03
"""
from alembic import op
import sqlalchemy as sa

revision = '20260703_bahan_baku_v2'
down_revision = '20260703_mo_approval'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('bahan_baku',
        sa.Column('satuan_display', sa.String(50), nullable=True)
    )
    op.add_column('bahan_baku',
        sa.Column('konversi_factor', sa.Numeric(10, 4), nullable=True)
    )
    op.add_column('bahan_baku',
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('bahan_baku', 'updated_at')
    op.drop_column('bahan_baku', 'konversi_factor')
    op.drop_column('bahan_baku', 'satuan_display')
