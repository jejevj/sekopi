"""
Refactor porsi saham: dari per-grup ke per-user-per-grup.

Revision ID: 003_porsi_per_member
Revises: 002
Create Date: 2026-07-03
"""
from alembic import op
import sqlalchemy as sa

revision = '003_porsi_per_member'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Hapus kolom porsi_saham dari shareholder_groups
    op.drop_column('shareholder_groups', 'porsi_saham')

    # 2. Hapus tabel M2M lama (tidak punya kolom porsi)
    op.drop_table('shareholder_group_members')

    # 3. Buat ulang tabel shareholder_group_members sebagai association table dengan porsi_saham
    op.create_table(
        'shareholder_group_members',
        sa.Column('group_id', sa.Integer, sa.ForeignKey('shareholder_groups.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('user_id',  sa.Integer, sa.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('porsi_saham', sa.Numeric(5, 2), nullable=False, server_default='0'),
        sa.UniqueConstraint('group_id', 'user_id', name='uq_group_member'),
    )

    # 4. Tambah kolom user_id ke dividen_distribusi
    op.add_column('dividen_distribusi', sa.Column('user_id', sa.Integer, nullable=True))
    op.create_foreign_key('fk_dividen_user', 'dividen_distribusi', 'users', ['user_id'], ['id'])
    op.create_index('ix_dividen_distribusi_user_id', 'dividen_distribusi', ['user_id'])

    # 5. Hapus kolom porsi_saham lama dari dividen_distribusi (porsi_saham sekarang per-user)
    #    Kolom lama tetap ada — hanya semantiknya berubah (per-user bukan per-grup)
    #    Tidak perlu drop, tapi set NOT NULL setelah data diisi
    #    (migration ini asumsi tabel masih kosong / dev environment)
    op.alter_column('dividen_distribusi', 'user_id', nullable=False)


def downgrade() -> None:
    op.drop_index('ix_dividen_distribusi_user_id', 'dividen_distribusi')
    op.drop_constraint('fk_dividen_user', 'dividen_distribusi', type_='foreignkey')
    op.drop_column('dividen_distribusi', 'user_id')
    op.drop_table('shareholder_group_members')
    op.create_table(
        'shareholder_group_members',
        sa.Column('group_id', sa.Integer, sa.ForeignKey('shareholder_groups.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('user_id',  sa.Integer, sa.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
    )
    op.add_column('shareholder_groups', sa.Column('porsi_saham', sa.Numeric(5, 2), nullable=False, server_default='0'))
