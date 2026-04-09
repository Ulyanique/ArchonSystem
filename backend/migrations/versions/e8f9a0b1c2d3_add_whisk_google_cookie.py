"""add_whisk_google_cookie

Revision ID: e8f9a0b1c2d3
Revises: a9b0c1d2e3f4
Create Date: 2026-02-23

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e8f9a0b1c2d3'
down_revision: Union[str, Sequence[str], None] = 'a9b0c1d2e3f4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)
    if 'system_settings' in inspector.get_table_names():
        columns = [col['name'] for col in inspector.get_columns('system_settings')]
        if 'whisk_google_cookie' not in columns:
            op.add_column('system_settings', sa.Column('whisk_google_cookie', sa.String(4096), nullable=True, server_default=''))


def downgrade() -> None:
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)
    if 'system_settings' in inspector.get_table_names():
        columns = [col['name'] for col in inspector.get_columns('system_settings')]
        if 'whisk_google_cookie' in columns:
            op.drop_column('system_settings', 'whisk_google_cookie')
