"""context_budget_settings

Revision ID: b1c2d3e4f5a6
Revises: a0b1c2d3e4f5
Create Date: 2026-02-23

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b1c2d3e4f5a6'
down_revision: Union[str, Sequence[str], None] = 'a0b1c2d3e4f5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)
    if 'system_settings' not in inspector.get_table_names():
        return
    columns = [col['name'] for col in inspector.get_columns('system_settings')]
    defaults = [
        ('context_base_budget', sa.Integer(), '4000'),
        ('context_mentions_budget', sa.Integer(), '2000'),
        ('context_creator_chars', sa.Integer(), '8000'),
        ('context_technologies_budget', sa.Integer(), '4000'),
    ]
    for col_name, col_type, server_default in defaults:
        if col_name not in columns:
            op.add_column(
                'system_settings',
                sa.Column(col_name, col_type, nullable=True, server_default=server_default)
            )


def downgrade() -> None:
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)
    if 'system_settings' not in inspector.get_table_names():
        return
    columns = [col['name'] for col in inspector.get_columns('system_settings')]
    for col_name in ('context_base_budget', 'context_mentions_budget', 'context_creator_chars', 'context_technologies_budget'):
        if col_name in columns:
            op.drop_column('system_settings', col_name)
