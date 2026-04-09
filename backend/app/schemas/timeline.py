from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime

class TimelineEventBase(BaseModel):
    title: str
    description: str = ""
    date_value: Optional[str] = None
    sort_order: int = 0
    universe_year: Optional[int] = None
    universe_day: Optional[int] = None
    event_type: str = "general"
    chapter_id: Optional[int] = None
    location_id: Optional[int] = None
    character_ids: List[int] = []

class TimelineEventCreate(TimelineEventBase):
    universe_id: Optional[int] = None  # берётся из URL

class TimelineEventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    date_value: Optional[str] = None
    sort_order: Optional[int] = None
    universe_year: Optional[int] = None
    universe_day: Optional[int] = None
    event_type: Optional[str] = None
    chapter_id: Optional[int] = None
    location_id: Optional[int] = None
    character_ids: Optional[List[int]] = None
    witness_character_ids: Optional[List[int]] = None
    heard_by_character_ids: Optional[List[int]] = None
    read_by_character_ids: Optional[List[int]] = None

class TimelineEvent(TimelineEventBase):
    id: int
    universe_id: int = Field(alias="universe_id", serialization_alias="universe_id")
    witness_character_ids: List[int] = []
    heard_by_character_ids: List[int] = []
    read_by_character_ids: List[int] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
