"""Add speech_development to characters (human vs ageless speech by age)

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-02-18 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(conn, table: str) -> bool:
    """Проверяет существование таблицы."""
    if conn.dialect.name == "sqlite":
        result = conn.execute(sa.text("SELECT name FROM sqlite_master WHERE type='table' AND name=:table"), {"table": table})
        return result.scalar() is not None
    return False


def _column_exists(conn, table: str, column: str) -> bool:
    """Проверяет существование колонки в таблице."""
    if not _table_exists(conn, table):
        return False
    if conn.dialect.name == "sqlite":
        result = conn.execute(sa.text(f"PRAGMA table_info({table})"))
        return any(row[1] == column for row in result)
    return False


def upgrade() -> None:
    """Upgrade schema."""
    conn = op.get_bind()
    # Проверяем существование таблицы перед изменением
    if _table_exists(conn, "characters") and not _column_exists(conn, "characters", "speech_development"):
        op.add_column('characters', sa.Column('speech_development', sa.String(20), nullable=True, server_default=sa.text("'human'")))


def downgrade() -> None:
    """Downgrade schema."""
    conn = op.get_bind()
    # Проверяем существование таблицы перед изменением
    if _table_exists(conn, "characters") and _column_exists(conn, "characters", "speech_development"):
        op.drop_column('characters', 'speech_development')
