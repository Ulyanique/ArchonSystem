from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database import Base

class Link(Base):
    __tablename__ = "links"

    id = Column(Integer, primary_key=True, index=True)
    universe_id = Column(Integer, nullable=False, index=True)

    # От кого связь (тип и ID)
    source_type = Column(String(50), nullable=False)  # character, location, chapter, note
    source_id = Column(Integer, nullable=False)

    # К кому связь (тип и ID)
    target_type = Column(String(50), nullable=False)  # character, location, chapter, note
    target_id = Column(Integer, nullable=False)

    # Тип связи
    link_type = Column(String(100), default="related")  # related, friend, enemy, family, located_in, appears_in, etc.
    description = Column(Text, default="")  # Описание связи

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

