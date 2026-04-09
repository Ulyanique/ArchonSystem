from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database import Base

class Location(Base):
    __tablename__ = "locations"

    id = Column(Integer, primary_key=True, index=True)
    universe_id = Column(Integer, nullable=False, index=True)
    celestial_body_id = Column(Integer, ForeignKey("celestial_bodies.id"), nullable=True, index=True)  # локация на небесном теле
    name = Column(String(255), nullable=False)
    description = Column(Text, default="")
    location_type = Column(String(100), default="")  # город, здание, регион и т.д.
    details = Column(Text, default="")  # дополнительные детали
    enabled = Column(Boolean, default=True)
    image_path = Column(String(512), nullable=True)  # путь к изображению локации
    image_ai_prompt = Column(Text, nullable=True)  # промпт для генерации изображения
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

