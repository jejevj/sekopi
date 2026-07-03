"""
Refactor porsi saham: dari per-grup ke per-user-per-grup.

Revision ID: 003_porsi_per_member
Revises: 20260703_dividen_v1
Create Date: 2026-07-03
"""
from alembic import op
import sqlalchemy as sa

revision = '003_porsi_per_member'
down_revision = '20260703_dividen_v1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Hapus kolom porsi_saham dari shareholder_groups
    op.drop_column('shareholder_groups', 'porsi_saham')

    # 2. Hapus tabel M2M lama (tanpa kolom porsi)
    op.drop_table('shareholder_group_members')

    # 3. Buat ulang shareholder_group_members sebagai association table dengan porsi_saham
    op.create_table(
        'shareholder_group_members',
        sa.Column('group_id', sa.Integer, sa.ForeignKey('shareholder_groups.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('user_id',  sa.Integer, sa.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('porsi_saham', sa.Numeric(5, 2), nullable=False, server_default='0'),
        sa.UniqueConstraint('group_id', 'user_id', name='uq_group_member'),
    )

    # 4. Tambah kolom user_id (FK ke users) ke dividen_distribusi
    op.add_column('dividen_distribusi', sa.Column('user_id', sa.Integer, nullable=True))
    op.create_foreign_key('fk_dividen_user', 'dividen_distribusi', 'users', ['user_id'], ['id'])
    op.create_index('ix_dividen_distribusi_user_id', 'dividen_distribusi', ['user_id'])

    # 5. Tambah kolom user_nama sebagai snapshot nama pemegang saham
    op.add_column('dividen_distribusi', sa.Column('user_nama', sa.String(200), nullable=True))

    # Catatan: user_id dibiarkan nullable=True agar aman jika tabel sudah ada data lama.
    # Untuk fresh dev env, data sudah kosong sehingga ini tidak jadi masalah.


def downgrade() -> None:
    op.drop_index('ix_dividen_distribusi_user_id', 'dividen_distribusi')
    op.drop_constraint('fk_dividen_user', 'dividen_distribusi', type_='foreignkey')
    op.drop_column('dividen_distribusi', 'user_nama')
    op.drop_column('dividen_distribusi', 'user_id')
    op.drop_table('shareholder_group_members')
    op.create_table(
        'shareholder_group_members',
        sa.Column('group_id', sa.Integer, sa.ForeignKey('shareholder_groups.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('user_id',  sa.Integer, sa.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
    )
    op.add_column('shareholder_groups', sa.Column('porsi_saham', sa.Numeric(5, 2), nullable=False, server_default='0'))
