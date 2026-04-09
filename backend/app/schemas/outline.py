from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime

class OutlineItemBase(BaseModel):
    title: str
    summary: str = ""
    outline_type: str = "chapter"  # act, chapter, beat
    sort_order: int = 0
    enabled: bool = True
    chapter_id: Optional[int] = None

class OutlineItemCreate(OutlineItemBase):
    universe_id: int

class OutlineItemCreateRequest(OutlineItemBase):
    """Тело запроса без universe_id (берётся из URL)."""
    pass

class OutlineItemUpdate(BaseModel):
    title: Optional[str] = None
    summary: Optional[str] = None
    outline_type: Optional[str] = None
    sort_order: Optional[int] = None
    chapter_id: Optional[int] = None
    enabled: Optional[bool] = None

class OutlineItem(OutlineItemBase):
    id: int
    universe_id: int
    chapter_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
