"""add_toast_settings

Revision ID: a9b0c1d2e3f4
Revises: d5e6f7a8b9c0
Create Date: 2026-02-20

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a9b0c1d2e3f4'
down_revision: Union[str, Sequence[str], None] = 'd5e6f7a8b9c0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)
    if 'system_settings' not in inspector.get_table_names():
        return
    columns = [col['name'] for col in inspector.get_columns('system_settings')]
    if 'show_toast_notifications' not in columns:
        op.add_column('system_settings', sa.Column('show_toast_notifications', sa.Boolean(), nullable=True, server_default='1'))
    if 'toast_position' not in columns:
        op.add_column('system_settings', sa.Column('toast_position', sa.String(30), nullable=True, server_default='bottom-center'))
    if 'toast_duration' not in columns:
        op.add_column('system_settings', sa.Column('toast_duration', sa.Integer(), nullable=True, server_default='3000'))


def downgrade() -> None:
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)
    if 'system_settings' not in inspector.get_table_names():
        return
    columns = [col['name'] for col in inspector.get_columns('system_settings')]
    if 'show_toast_notifications' in columns:
        op.drop_column('system_settings', 'show_toast_notifications')
    if 'toast_position' in columns:
        op.drop_column('system_settings', 'toast_position')
    if 'toast_duration' in columns:
        op.drop_column('system_settings', 'toast_duration')
