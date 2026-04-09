"""Упоминания сущностей мира в главах — для отслеживания покрытия (НФ)."""
from sqlalchemy import Column, Integer, String, ForeignKey, UniqueConstraint
from app.database import Base


class ChapterMention(Base):
    """Связь главы с сущностью мира: персонаж, локация, технология, артефакт, фракция."""
    __tablename__ = "chapter_mentions"

    id = Column(Integer, primary_key=True, index=True)
    chapter_id = Column(Integer, ForeignKey("chapters.id", ondelete="CASCADE"), nullable=False, index=True)
    entity_type = Column(String(32), nullable=False, index=True)  # character | location | technology | artifact | faction
    entity_id = Column(Integer, nullable=False, index=True)

    __table_args__ = (
        UniqueConstraint("chapter_id", "entity_type", "entity_id", name="uq_chapter_mention"),
    )
