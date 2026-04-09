"""add_openrouter_image_model

Revision ID: f8a9b0c1d2e3
Revises: 6532435156c5
Create Date: 2026-02-19

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f8a9b0c1d2e3'
down_revision: Union[str, Sequence[str], None] = 'e7f8a9b0c1d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)
    tables = inspector.get_table_names()
    if 'system_settings' in tables:
        columns = [col['name'] for col in inspector.get_columns('system_settings')]
        if 'openrouter_image_model' not in columns:
            op.add_column('system_settings', sa.Column('openrouter_image_model', sa.String(200), nullable=True, server_default='google/gemini-2.5-flash-image'))


def downgrade() -> None:
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)
    tables = inspector.get_table_names()
    if 'system_settings' in tables:
        columns = [col['name'] for col in inspector.get_columns('system_settings')]
        if 'openrouter_image_model' in columns:
            op.drop_column('system_settings', 'openrouter_image_model')
