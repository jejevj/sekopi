"""add pengeluaran table and user_id to dividen_distribusi

Revision ID: 20260703_pengeluaran_fix
Revises: 003_porsi_per_member
Create Date: 2026-07-03

Semua operasi pakai IF NOT EXISTS / cek manual agar idempoten
(aman dijalankan meski sebagian sudah teraplikasi di DB).
"""
from alembic import op
import sqlalchemy as sa

revision      = '20260703_pengeluaran_fix'
down_revision = '003_porsi_per_member'
branch_labels = None
depends_on    = None


def _table_exists(conn, table_name: str) -> bool:
    result = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.tables "
        "WHERE table_schema='public' AND table_name=:t"
    ), {"t": table_name})
    return result.fetchone() is not None


def _column_exists(conn, table_name: str, column_name: str) -> bool:
    result = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name=:t AND column_name=:c"
    ), {"t": table_name, "c": column_name})
    return result.fetchone() is not None


def _index_exists(conn, index_name: str) -> bool:
    result = conn.execute(sa.text(
        "SELECT 1 FROM pg_indexes WHERE indexname=:i"
    ), {"i": index_name})
    return result.fetchone() is not None


def upgrade() -> None:
    conn = op.get_bind()

    # ── 1. Tabel pengeluaran ────────────────────────────────────
    if not _table_exists(conn, 'pengeluaran'):
        op.create_table(
            'pengeluaran',
            sa.Column('id',          sa.Integer,                primary_key=True),
            sa.Column('nama',        sa.String(200),            nullable=False),
            sa.Column('jumlah',      sa.Numeric(14, 2),         nullable=False),
            sa.Column('kategori',    sa.String(30),             nullable=False, server_default='lainnya'),
            sa.Column('tanggal',     sa.Date,                   nullable=False),
            sa.Column('catatan',     sa.String(500),            nullable=True),
            sa.Column('dibuat_oleh', sa.Integer,                sa.ForeignKey('users.id'), nullable=False),
            sa.Column('created_at',  sa.DateTime(timezone=True), nullable=True),
        )

    if not _index_exists(conn, 'ix_pengeluaran_tanggal'):
        op.create_index('ix_pengeluaran_tanggal', 'pengeluaran', ['tanggal'])

    if not _index_exists(conn, 'ix_pengeluaran_id'):
        op.create_index('ix_pengeluaran_id', 'pengeluaran', ['id'])

    # ── 2. user_id di dividen_distribusi ─────────────────────────
    if not _column_exists(conn, 'dividen_distribusi', 'user_id'):
        op.add_column(
            'dividen_distribusi',
            sa.Column('user_id', sa.Integer, sa.ForeignKey('users.id'), nullable=True),
        )
        op.execute(sa.text(
            "UPDATE dividen_distribusi SET user_id = dibuat_oleh WHERE user_id IS NULL"
        ))
        op.alter_column('dividen_distribusi', 'user_id', nullable=False)

    if not _index_exists(conn, 'ix_dividen_user'):
        op.create_index('ix_dividen_user', 'dividen_distribusi', ['user_id'])


def downgrade() -> None:
    conn = op.get_bind()
    if _index_exists(conn, 'ix_pengeluaran_tanggal'):
        op.drop_index('ix_pengeluaran_tanggal', 'pengeluaran')
    if _index_exists(conn, 'ix_pengeluaran_id'):
        op.drop_index('ix_pengeluaran_id', 'pengeluaran')
    if _table_exists(conn, 'pengeluaran'):
        op.drop_table('pengeluaran')
    if _index_exists(conn, 'ix_dividen_user'):
        op.drop_index('ix_dividen_user', 'dividen_distribusi')
