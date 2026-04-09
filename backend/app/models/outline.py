from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database import Base

class OutlineItem(Base):
    __tablename__ = "outline_items"

    id = Column(Integer, primary_key=True, index=True)
    universe_id = Column(Integer, nullable=False, index=True)
    sort_order = Column(Integer, default=0)
    title = Column(String(255), nullable=False)
    summary = Column(Text, default="")
    outline_type = Column(String(50), default="chapter")  # act, chapter, beat
    chapter_id = Column(Integer, ForeignKey("chapters.id"), nullable=True)
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

