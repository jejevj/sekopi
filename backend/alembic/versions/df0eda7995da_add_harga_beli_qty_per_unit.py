"""add harga_beli qty_per_unit

Revision ID: df0eda7995da
Revises: 20260703_pengeluaran_fix
Create Date: 2026-07-03 14:07:31.198275

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'df0eda7995da'
down_revision: Union[str, None] = '20260703_pengeluaran_fix'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('bahan_baku', sa.Column('harga_beli_per_satuan', sa.Numeric(precision=14, scale=2), nullable=True))
    op.add_column('mo_bahan_baku', sa.Column('qty_per_unit', sa.Numeric(precision=12, scale=6), nullable=True))


def downgrade() -> None:
    op.drop_column('mo_bahan_baku', 'qty_per_unit')
    op.drop_column('bahan_baku', 'harga_beli_per_satuan')
