"""add_cloudflare_image_settings

Revision ID: b3c4d5e6f7a8
Revises: e7f8a9b0c1d2
Create Date: 2026-02-19

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b3c4d5e6f7a8'
down_revision: Union[str, Sequence[str], None] = 'f8a9b0c1d2e3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)
    tables = inspector.get_table_names()
    if 'system_settings' in tables:
        columns = [col['name'] for col in inspector.get_columns('system_settings')]
        if 'image_provider' not in columns:
            op.add_column('system_settings', sa.Column('image_provider', sa.String(50), nullable=True, server_default='openrouter'))
        if 'cloudflare_image_url' not in columns:
            op.add_column('system_settings', sa.Column('cloudflare_image_url', sa.String(512), nullable=True, server_default=''))
        if 'cloudflare_image_api_key' not in columns:
            op.add_column('system_settings', sa.Column('cloudflare_image_api_key', sa.String(255), nullable=True, server_default=''))


def downgrade() -> None:
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)
    if 'system_settings' in inspector.get_table_names():
        columns = [col['name'] for col in inspector.get_columns('system_settings')]
        for col_name in ('cloudflare_image_api_key', 'cloudflare_image_url', 'image_provider'):
            if col_name in columns:
                op.drop_column('system_settings', col_name)
