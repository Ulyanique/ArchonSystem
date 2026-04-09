from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database import Base

class WikiArticle(Base):
    """Статья вики вселенной. Markdown, гиперссылки [[entity_type:entity_id|text]]."""
    __tablename__ = "wiki_articles"
    __table_args__ = (UniqueConstraint("universe_id", "slug", name="uq_wiki_article_book_slug"),)

    id = Column(Integer, primary_key=True, index=True)
    universe_id = Column(Integer, nullable=False, index=True)  # universe
    title = Column(String(255), nullable=False)
    slug = Column(String(255), nullable=False, index=True)
    content = Column(Text, default="")
    article_type = Column(String(50), default="manual")  # auto, manual, hybrid
    linked_entity_type = Column(String(50), nullable=True)  # character, location, event
    linked_entity_id = Column(Integer, nullable=True)
    auto_generated = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

