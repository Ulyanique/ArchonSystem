"""Add universe calendar fields for chat time (character birth/death, timeline event date)

Revision ID: a1b2c3d4e5f6
Revises: 63d657c89f24
Create Date: 2026-02-18 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '63d657c89f24'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Проверяем, существуют ли таблицы перед их изменением
    # Эти таблицы находятся в базах вселенных, а не в мастер-базе
    # Поэтому они могут отсутствовать в мастер-базе
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)
    tables = inspector.get_table_names()
    
    # Добавляем колонки в таблицу characters, если она существует
    if 'characters' in tables:
        columns = [col['name'] for col in inspector.get_columns('characters')]
        if 'birth_universe_year' not in columns:
            op.add_column('characters', sa.Column('birth_universe_year', sa.Integer(), nullable=True))
        if 'birth_universe_day' not in columns:
            op.add_column('characters', sa.Column('birth_universe_day', sa.Integer(), nullable=True))
        if 'death_universe_year' not in columns:
            op.add_column('characters', sa.Column('death_universe_year', sa.Integer(), nullable=True))
        if 'death_universe_day' not in columns:
            op.add_column('characters', sa.Column('death_universe_day', sa.Integer(), nullable=True))
    
    # Добавляем колонки в таблицу timeline_events, если она существует
    if 'timeline_events' in tables:
        columns = [col['name'] for col in inspector.get_columns('timeline_events')]
        if 'universe_year' not in columns:
            op.add_column('timeline_events', sa.Column('universe_year', sa.Integer(), nullable=True))
        if 'universe_day' not in columns:
            op.add_column('timeline_events', sa.Column('universe_day', sa.Integer(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)
    tables = inspector.get_table_names()
    
    # Удаляем колонки из таблицы timeline_events, если она существует
    if 'timeline_events' in tables:
        columns = [col['name'] for col in inspector.get_columns('timeline_events')]
        if 'universe_day' in columns:
            op.drop_column('timeline_events', 'universe_day')
        if 'universe_year' in columns:
            op.drop_column('timeline_events', 'universe_year')
    
    # Удаляем колонки из таблицы characters, если она существует
    if 'characters' in tables:
        columns = [col['name'] for col in inspector.get_columns('characters')]
        if 'death_universe_day' in columns:
            op.drop_column('characters', 'death_universe_day')
        if 'death_universe_year' in columns:
            op.drop_column('characters', 'death_universe_year')
        if 'birth_universe_day' in columns:
            op.drop_column('characters', 'birth_universe_day')
        if 'birth_universe_year' in columns:
            op.drop_column('characters', 'birth_universe_year')
