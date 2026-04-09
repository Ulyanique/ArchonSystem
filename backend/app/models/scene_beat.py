from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from datetime import datetime, timezone
from app.database import Base


class SceneBeat(Base):
    """Scene beat (блок сцены) внутри главы. Порядок по sort_order."""
    __tablename__ = "scene_beats"

    id = Column(Integer, primary_key=True, index=True)
    chapter_id = Column(Integer, ForeignKey("chapters.id", ondelete="CASCADE"), nullable=False, index=True)
    sort_order = Column(Integer, default=0)
    title = Column(String(255), default="")  # короткий ярлык (например «Сцена 1»)
    description = Column(Text, default="")   # неизменяемое описание сцены (что происходит; для ИИ и плана)
    content = Column(Text, default="")      # сгенерированный/написанный текст сцены
    enabled = Column(Boolean, default=True)   # False = скрыть из контекста и затемнить в UI
    collapsed = Column(Boolean, default=False)  # True = свёрнуто (текст сцены скрыт в редакторе)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
