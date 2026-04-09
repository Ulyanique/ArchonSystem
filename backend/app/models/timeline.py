from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Table
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database import Base

# Таблица многие-ко-многим для связи событий и персонажей (участники)
timeline_characters = Table(
    'timeline_characters',
    Base.metadata,
    Column('event_id', Integer, ForeignKey('timeline_events.id'), primary_key=True),
    Column('character_id', Integer, ForeignKey('characters.id'), primary_key=True)
)

# Кто видел событие (очевидцы)
event_witnesses = Table(
    'event_witnesses',
    Base.metadata,
    Column('event_id', Integer, ForeignKey('timeline_events.id'), primary_key=True),
    Column('character_id', Integer, ForeignKey('characters.id'), primary_key=True)
)

# Кто услышал о событии
event_heard_by = Table(
    'event_heard_by',
    Base.metadata,
    Column('event_id', Integer, ForeignKey('timeline_events.id'), primary_key=True),
    Column('character_id', Integer, ForeignKey('characters.id'), primary_key=True)
)

# Кто прочитал о событии
event_read_by = Table(
    'event_read_by',
    Base.metadata,
    Column('event_id', Integer, ForeignKey('timeline_events.id'), primary_key=True),
    Column('character_id', Integer, ForeignKey('characters.id'), primary_key=True)
)

class TimelineEvent(Base):
    __tablename__ = "timeline_events"

    id = Column(Integer, primary_key=True, index=True)
    universe_id = Column(Integer, nullable=False, index=True)

    # Информация о событии
    title = Column(String(255), nullable=False)
    description = Column(Text, default="")

    # Время/дата события (может быть относительным)
    date_value = Column(String(100), nullable=True)  # "1234 год", "День 5", "Глава 3"
    sort_order = Column(Integer, default=0)  # Для сортировки событий
    # Дата в календаре вселенной (для фильтра «события до момента чата»)
    universe_year = Column(Integer, nullable=True)
    universe_day = Column(Integer, nullable=True)

    # Тип события
    event_type = Column(String(50), default="general")  # general, battle, meeting, journey, death, birth, etc.

    # Привязка к элементам
    chapter_id = Column(Integer, ForeignKey("chapters.id"), nullable=True)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=True)

    # Участники (персонажи) - многие-ко-многим
    characters = relationship("Character", secondary="timeline_characters", back_populates="timeline_events")
    # Очевидцы, кто услышал, кто прочитал
    witness_characters = relationship("Character", secondary="event_witnesses")
    heard_by_characters = relationship("Character", secondary="event_heard_by")
    read_by_characters = relationship("Character", secondary="event_read_by")

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


    @property
    def character_ids(self):
        return [c.id for c in self.characters]

    @property
    def witness_character_ids(self):
        return [c.id for c in self.witness_characters]

    @property
    def heard_by_character_ids(self):
        return [c.id for c in self.heard_by_characters]

    @property
    def read_by_character_ids(self):
        return [c.id for c in self.read_by_characters]
