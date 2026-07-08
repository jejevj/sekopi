"""foto_url VARCHAR(500) to TEXT

Revision ID: 0010
Revises: 20260703_add_approved_inventori_fields_mo
Create Date: 2026-07-08
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '0010'
down_revision = '20260703_add_approved_inventori_fields_mo'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Ubah kolom foto_url dari VARCHAR(500) menjadi TEXT
    op.alter_column(
        'absensi',
        'foto_url',
        existing_type=sa.String(length=500),
        type_=sa.Text(),
        existing_nullable=True,
    )


def downgrade() -> None:
    # Rollback: potong data jika lebih dari 500 karakter lalu kembalikan ke VARCHAR(500)
    op.execute(
        "UPDATE absensi SET foto_url = LEFT(foto_url, 500) WHERE LENGTH(foto_url) > 500"
    )
    op.alter_column(
        'absensi',
        'foto_url',
        existing_type=sa.Text(),
        type_=sa.String(length=500),
        existing_nullable=True,
    )
