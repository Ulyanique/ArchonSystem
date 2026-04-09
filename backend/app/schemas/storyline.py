from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime


class StorylineBase(BaseModel):
    title: str
    description: str = ""
    sort_order: int = 0
    main_character_id: Optional[int] = None


class StorylineCreate(StorylineBase):
    universe_id: Optional[int] = None


class StorylineUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    sort_order: Optional[int] = None
    main_character_id: Optional[int] = None


class Storyline(StorylineBase):
    id: int
    universe_id: int = Field(alias="universe_id", serialization_alias="universe_id")
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
