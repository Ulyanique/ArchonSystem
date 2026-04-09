from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime

class WikiArticleBase(BaseModel):
    title: str
    content: str = ""
    article_type: str = "manual"  # auto, manual, hybrid
    linked_entity_type: Optional[str] = None
    linked_entity_id: Optional[int] = None
    auto_generated: bool = False

class WikiArticleCreate(WikiArticleBase):
    slug: Optional[str] = None  # если не задан — генерируется из title

class WikiArticleUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    content: Optional[str] = None
    article_type: Optional[str] = None
    linked_entity_type: Optional[str] = None
    linked_entity_id: Optional[int] = None
    auto_generated: Optional[bool] = None

class WikiArticle(WikiArticleBase):
    id: int
    universe_id: int
    slug: str
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)
