from sqlalchemy import Column, Integer, String, Text, DateTime, Float, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database import Base

class Galaxy(Base):
    """Галактики во вселенной."""
    __tablename__ = "galaxies"

    id = Column(Integer, primary_key=True, index=True)
    universe_id = Column(Integer, index=True)

    name = Column(String(255), nullable=False)
    description = Column(Text, default="")
    galaxy_type = Column(String(100), default="") # Спиральная, эллиптическая и т.д.

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    star_systems = relationship("StarSystem", back_populates="galaxy", cascade="all, delete-orphan")

class StarSystem(Base):
    """Звёздные системы в галактике."""
    __tablename__ = "star_systems"

    id = Column(Integer, primary_key=True, index=True)
    universe_id = Column(Integer, index=True)
    galaxy_id = Column(Integer, ForeignKey("galaxies.id"), nullable=False, index=True)

    name = Column(String(255), nullable=False)
    description = Column(Text, default="")

    # Координаты в галактике (опционально)
    coord_x = Column(Float, default=0.0)
    coord_y = Column(Float, default=0.0)
    coord_z = Column(Float, default=0.0)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    galaxy = relationship("Galaxy", back_populates="star_systems")
    celestial_bodies = relationship("CelestialBody", back_populates="star_system", cascade="all, delete-orphan")

class CelestialBody(Base):
    """Планеты, спутники, астероиды, корабли в звёздной системе."""
    __tablename__ = "celestial_bodies"

    id = Column(Integer, primary_key=True, index=True)
    universe_id = Column(Integer, index=True)
    star_system_id = Column(Integer, ForeignKey("star_systems.id"), nullable=False, index=True)
    parent_body_id = Column(Integer, ForeignKey("celestial_bodies.id"), nullable=True, index=True)  # спутник орбитирует планету/тело

    name = Column(String(255), nullable=False)
    description = Column(Text, default="")
    body_type = Column(String(100), default="")  # Планета, Спутник, Астероид, Станция, Корабль

    # Данные для карты местности (сетка)
    map_width = Column(Integer, default=10)  # ширина сетки
    map_height = Column(Integer, default=10)  # высота сетки
    map_data = Column(Text, default="[]")  # JSON данные ячеек

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    star_system = relationship("StarSystem", back_populates="celestial_bodies")
    parent_body = relationship("CelestialBody", remote_side=[id], backref="satellites")
