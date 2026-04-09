from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database import Base


class Chapter(Base):
    __tablename__ = "chapters"

    id = Column(Integer, primary_key=True, index=True)
    universe_id = Column(Integer, nullable=False, index=True)
    title = Column(String(255), nullable=False)
    chapter_number = Column(Integer, default=1)
    content = Column(Text, default="")
    summary = Column(Text, default="")  # краткое содержание
    notes = Column(Text, default="")  # заметки к главе
    enabled = Column(Boolean, default=True)
    # Параллельные сюжетные линии
    storyline_id = Column(Integer, ForeignKey("storylines.id"), nullable=True, index=True)
    storyline_order = Column(Integer, default=0)  # порядок внутри линии
    reading_order = Column(Integer, nullable=True)  # глобальный порядок чтения (для чередования)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

