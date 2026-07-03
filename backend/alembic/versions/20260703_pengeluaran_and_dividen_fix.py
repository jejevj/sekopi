"""add pengeluaran table and user_id to dividen_distribusi

Revision ID: 20260703_pengeluaran_fix
Revises: 003_porsi_per_member
Create Date: 2026-07-03

Kenapa tidak ALTER status ke enum:
  Kolom status sudah VARCHAR(20) dari migration dividen_v1.
  Model SQLAlchemy pakai values_callable sehingga tetap kompatibel dengan VARCHAR.
  Tidak perlu CREATE TYPE — hindari error 'type statusdividen does not exist'.
"""
from alembic import op
import sqlalchemy as sa

revision      = '20260703_pengeluaran_fix'
down_revision = '003_porsi_per_member'
branch_labels = None
depends_on    = None


def upgrade() -> None:
    # ── 1. Tabel pengeluaran ─────────────────────────────────────────────
    op.create_table(
        'pengeluaran',
        sa.Column('id',          sa.Integer,                primary_key=True, index=True),
        sa.Column('nama',        sa.String(200),            nullable=False),
        sa.Column('jumlah',      sa.Numeric(14, 2),         nullable=False),
        sa.Column('kategori',    sa.String(30),             nullable=False, server_default='lainnya'),
        sa.Column('tanggal',     sa.Date,                   nullable=False, index=True),
        sa.Column('catatan',     sa.String(500),            nullable=True),
        sa.Column('dibuat_oleh', sa.Integer,                sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at',  sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_pengeluaran_tanggal', 'pengeluaran', ['tanggal'])

    # ── 2. Tambah user_id ke dividen_distribusi (jika belum ada) ─────────
    # Cek dengan try/except karena mungkin migration lokal sudah menambahnya
    conn = op.get_bind()
    cols = [row[0] for row in conn.execute(
        sa.text("SELECT column_name FROM information_schema.columns WHERE table_name='dividen_distribusi'")
    )]
    if 'user_id' not in cols:
        op.add_column(
            'dividen_distribusi',
            sa.Column('user_id', sa.Integer, sa.ForeignKey('users.id'), nullable=True),
        )
        op.create_index('ix_dividen_user', 'dividen_distribusi', ['user_id'])
        # Set nullable=False setelah kolom ada (beri default 0 dulu agar aman)
        op.execute(sa.text("UPDATE dividen_distribusi SET user_id = dibuat_oleh WHERE user_id IS NULL"))
        op.alter_column('dividen_distribusi', 'user_id', nullable=False)


def downgrade() -> None:
    op.drop_index('ix_pengeluaran_tanggal', 'pengeluaran')
    op.drop_table('pengeluaran')
    # Tidak drop user_id karena mungkin sudah ada sebelumnya
