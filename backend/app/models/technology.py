from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from datetime import datetime, timezone
from app.database import Base

class Technology(Base):
    """Технологии вселенной."""
    __tablename__ = "technologies"

    id = Column(Integer, primary_key=True, index=True)
    universe_id = Column(Integer, index=True)

    name = Column(String(255), nullable=False)
    description = Column(Text, default="")
    tech_level = Column(String(100), default="") # Примитивная, продвинутая, и т.д.

    principles = Column(Text, default="")
    application = Column(Text, default="")

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

class Artifact(Base):
    """Артефакты и уникальные предметы."""
    __tablename__ = "artifacts"

    id = Column(Integer, primary_key=True, index=True)
    universe_id = Column(Integer, index=True)

    name = Column(String(255), nullable=False)
    description = Column(Text, default="")
    artifact_type = Column(String(100), default="") # Магический, технологический, древний и т.д.

    origin = Column(Text, default="")
    abilities = Column(Text, default="")
    location_hint = Column(Text, default="")
    owner_id = Column(Integer, nullable=True) # Ссылка на персонажа (не FK для гибкости)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
