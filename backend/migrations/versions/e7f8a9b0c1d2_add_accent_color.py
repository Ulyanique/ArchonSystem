"""add_accent_color

Revision ID: e7f8a9b0c1d2
Revises: 6532435156c5
Create Date: 2026-02-19

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e7f8a9b0c1d2'
down_revision: Union[str, Sequence[str], None] = '6532435156c5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)
    tables = inspector.get_table_names()
    if 'system_settings' in tables:
        columns = [col['name'] for col in inspector.get_columns('system_settings')]
        if 'accent_color' not in columns:
            op.add_column('system_settings', sa.Column('accent_color', sa.String(20), nullable=True, server_default='green'))


def downgrade() -> None:
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)
    if 'system_settings' in inspector.get_table_names():
        columns = [col['name'] for col in inspector.get_columns('system_settings')]
        if 'accent_color' in columns:
            op.drop_column('system_settings', 'accent_color')
