from sqlalchemy import Column, Integer, String, Text, DateTime, Float, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database import MasterBase

class Universe(MasterBase):
    """Вселенная — контейнер для метаданных и настроек. Сами сущности хранятся в изолированных БД."""
    __tablename__ = "universes"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, default="")
    genre = Column(String(100), default="")
    direction = Column(Text, default="")  # направление/премиса для ИИ
    cover_image_path = Column(String(512), nullable=True)  # путь к обложке
    style_notes = Column(Text, default="")  # стилистика, тон для ИИ
    universe_type = Column(String(100), default="")  # fantasy, sci-fi, etc.

    # Настройки внутреннего времени (Clock)
    clock_enabled = Column(Integer, default=0)  # 0: disabled, 1: enabled
    universe_start_year = Column(Integer, default=2026)
    universe_start_day = Column(Integer, default=1)
    universe_start_hour = Column(Integer, default=0)
    universe_hours_per_day = Column(Integer, default=24)
    universe_days_per_year = Column(Integer, default=365)
    universe_epoch_name = Column(String(100), default="н.э.")
    universe_reference_real_date = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    universe_time_scale = Column(Float, default=1.0)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Связи внутри Master DB
    books = relationship("Book", back_populates="universe", cascade="all, delete-orphan")

class Book(MasterBase):
    """Книга/продукт внутри вселенной. Хранится в Master DB."""
    __tablename__ = "books"

    id = Column(Integer, primary_key=True, index=True)
    universe_id = Column(Integer, ForeignKey("universes.id"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    universe = relationship("Universe", back_populates="books")

class GraphLayout(MasterBase):
    """Позиции узлов графа знаний. Хранится в Master DB."""
    __tablename__ = "graph_layout"
    universe_id = Column(Integer, ForeignKey("universes.id"), primary_key=True)
    node_id = Column(String(100), primary_key=True)
    x = Column(Float, nullable=False)
    y = Column(Float, nullable=False)
