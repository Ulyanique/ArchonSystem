from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Table
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database import Base

class Character(Base):
    __tablename__ = "characters"

    id = Column(Integer, primary_key=True, index=True)
    universe_id = Column(Integer, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, default="")
    role = Column(String(100), default="")  # главный, второстепенный, эпизодический
    traits = Column(Text, default="")  # черты характера
    appearance = Column(Text, default="")  # внешность
    backstory = Column(Text, default="")  # предыстория
    portrait_image_path = Column(String(512), nullable=True)  # путь к портрету
    portrait_ai_prompt = Column(Text, nullable=True)  # сгенерированный ИИ промпт для портрета
    ai_analysis = Column(Text, nullable=True)  # JSON с результатами AI анализа персонажа
    # Демографические данные
    age = Column(Integer, nullable=True)  # возраст персонажа
    gender = Column(String(50), nullable=True)  # пол/гендер
    nationality = Column(String(100), nullable=True)  # национальность
    birth_place = Column(String(255), nullable=True)  # место рождения
    birth_date = Column(String(100), nullable=True)  # дата рождения (текст)
    death_date = Column(String(100), nullable=True)  # дата смерти (текст)
    # Даты в календаре вселенной (для проверки «жив в момент X» в чате)
    birth_universe_year = Column(Integer, nullable=True)
    birth_universe_day = Column(Integer, nullable=True)
    death_universe_year = Column(Integer, nullable=True)
    death_universe_day = Column(Integer, nullable=True)
    # Отношения
    relationships = Column(Text, nullable=True)  # JSON с отношениями к другим персонажам
    # Навыки и способности
    profession = Column(String(200), nullable=True)  # профессия/род занятий
    skills = Column(Text, nullable=True)  # навыки и умения
    abilities = Column(Text, nullable=True)  # особые способности
    # Мотивация и цели
    goals = Column(Text, nullable=True)  # цели и желания персонажа
    fears = Column(Text, nullable=True)  # страхи персонажа
    conflicts = Column(Text, nullable=True)  # внутренние и внешние конфликты
    character_values = Column(Text, nullable=True)  # ценности и принципы (переименовано из values, т.к. values - зарезервированное слово в SQL)
    # Речь и манеры
    speech_pattern = Column(Text, nullable=True)  # манера речи, особенности речи
    mannerisms = Column(Text, nullable=True)  # жесты, привычные движения
    habits = Column(Text, nullable=True)  # привычки персонажа
    # Тип развития речи: human — речь зависит от возраста (до 3 лет — лепет/детская речь); ageless — не зависит (ИИ, робот)
    speech_development = Column(String(20), nullable=True, default="human")
    enabled = Column(Boolean, default=True)  # выключенные не попадают в контекст ИИ
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    knowledge_records = relationship("CharacterKnowledge", back_populates="character", cascade="all, delete-orphan")
    timeline_events = relationship("TimelineEvent", secondary="timeline_characters", back_populates="characters")

class CharacterKnowledge(Base):
    """Уровни доступа персонажа к информации о других сущностях (персонажи, события, локации)."""
    __tablename__ = "character_knowledge"

    id = Column(Integer, primary_key=True, index=True)
    character_id = Column(Integer, ForeignKey("characters.id"), nullable=False, index=True)
    target_type = Column(String(50), nullable=False)  # "character", "event", "location", "concept"
    target_id = Column(Integer, nullable=False)  # ID целевой сущности
    knowledge_level = Column(String(50), nullable=False)  # "none", "rumors", "superficial", "good", "complete"
    source_type = Column(String(50), nullable=True)  # "participated", "heard", "read", "learned_from"
    source_id = Column(Integer, nullable=True)  # для "learned_from" — ID персонажа-источника
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    character = relationship("Character", back_populates="knowledge_records")
