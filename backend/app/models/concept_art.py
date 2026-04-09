from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database import Base

class ConceptArt(Base):
    """Концепт-арт вселенной."""
    __tablename__ = "concept_arts"

    id = Column(Integer, primary_key=True, index=True)
    universe_id = Column(Integer, index=True)

    title = Column(String(255), nullable=False)
    description = Column(Text, default="")
    image_path = Column(String(512), nullable=False)

    # Метаданные для Pinterest-сетки
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    aspect_ratio = Column(String(50), nullable=True)

    # Категории и теги
    category = Column(String(100), default="other") # character, location, item, mood, etc.
    tags = Column(Text, default="") # JSON list of strings

    # Порядок отображения (для Drag & Drop)
    sort_order = Column(Integer, default=0)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
