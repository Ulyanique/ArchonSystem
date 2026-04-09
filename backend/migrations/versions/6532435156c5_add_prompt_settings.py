"""add_prompt_settings

Revision ID: 6532435156c5
Revises: b2c3d4e5f6a7
Create Date: 2026-02-19 20:11:23.362560

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6532435156c5'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)
    
    tables = inspector.get_table_names()
    
    if 'system_settings' in tables:
        columns = [col['name'] for col in inspector.get_columns('system_settings')]
        
        if 'prompt_settings' not in columns:
            op.add_column('system_settings', sa.Column('prompt_settings', sa.Text(), nullable=True, server_default='{}'))


def downgrade() -> None:
    """Downgrade schema."""
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)
    
    tables = inspector.get_table_names()
    
    if 'system_settings' in tables:
        columns = [col['name'] for col in inspector.get_columns('system_settings')]
        
        if 'prompt_settings' in columns:
            op.drop_column('system_settings', 'prompt_settings')
