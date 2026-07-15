"""absensi: tambah kolom foto_keluar_url

Revision ID: 0011
Revises: 0010, 0009
Create Date: 2026-07-15

Alasan: Kolom foto_url semula dipakai untuk foto masuk,
lalu ditimpa foto pulang saat catat_pulang dipanggil.
Fix: pisahkan menjadi dua kolom:
  - foto_url        -> foto saat absen MASUK (tidak berubah)
  - foto_keluar_url -> foto saat absen KELUAR (baru)

Migration ini sekaligus merge dua head yang terpisah:
  - 0010 (chain absensi / foto_url)
  - 0009 (chain production_unit / on_gerobak)
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0011'
down_revision = ('0010', '0009')
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'absensi',
        sa.Column('foto_keluar_url', sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('absensi', 'foto_keluar_url')
