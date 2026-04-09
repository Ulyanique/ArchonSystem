from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime

class ChapterBase(BaseModel):
    title: str
    chapter_number: int = 1
    content: str = ""
    summary: str = ""
    notes: str = ""
    enabled: bool = True
    storyline_id: Optional[int] = None
    storyline_order: int = 0
    reading_order: Optional[int] = None


class ChapterCreate(ChapterBase):
    universe_id: Optional[int] = None


class ChapterUpdate(BaseModel):
    title: Optional[str] = None
    chapter_number: Optional[int] = None
    content: Optional[str] = None
    summary: Optional[str] = None
    notes: Optional[str] = None
    enabled: Optional[bool] = None
    storyline_id: Optional[int] = None
    storyline_order: Optional[int] = None
    reading_order: Optional[int] = None


class Chapter(ChapterBase):
    id: int
    universe_id: int = Field(alias="universe_id", serialization_alias="universe_id")
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
