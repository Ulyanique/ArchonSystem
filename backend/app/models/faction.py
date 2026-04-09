from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database import Base

class Faction(Base):
    """Фракции и организации вселенной."""
    __tablename__ = "factions"

    id = Column(Integer, primary_key=True, index=True)
    universe_id = Column(Integer, index=True) # ID вселенной (в этой базе)

    name = Column(String(255), nullable=False)
    description = Column(Text, default="")
    faction_type = Column(String(100), default="") # Религиозная, военная, торговая и т.д.

    ideology = Column(Text, default="")
    goals = Column(Text, default="")
    headquarters = Column(Text, default="")
    leader_name = Column(String(255), default="")

    influence_level = Column(Integer, default=5) # 1-10

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Связи (опционально)
    # characters = relationship("Character", back_populates="faction")
