from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database import Base

class Quote(Base):
    __tablename__ = "quotes"

    id = Column(Integer, primary_key=True, index=True)
    universe_id = Column(Integer, nullable=False, index=True)
    character_id = Column(Integer, ForeignKey("characters.id"), nullable=False, index=True)  # Кто сказал
    interlocutor_type = Column(String(50), nullable=False)  # "character" | "author" | "helper"
    interlocutor_id = Column(Integer, ForeignKey("characters.id"), nullable=True)  # ID персонажа-собеседника (если interlocutor_type = "character")
    quote_text = Column(Text, nullable=False)  # Текст цитаты
    context = Column(Text, nullable=True)  # Контекст разговора (опционально)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    character = relationship("Character", foreign_keys=[character_id])
    interlocutor_character = relationship("Character", foreign_keys=[interlocutor_id])
