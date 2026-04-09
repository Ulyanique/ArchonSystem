from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database import Base


class Storyline(Base):
    """Сюжетная линия (параллельный сюжет). Хранится в БД вселенной."""
    __tablename__ = "storylines"

    id = Column(Integer, primary_key=True, index=True)
    universe_id = Column(Integer, nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, default="")
    sort_order = Column(Integer, default=0)
    main_character_id = Column(Integer, ForeignKey("characters.id"), nullable=True, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
