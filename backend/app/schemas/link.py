from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime

class LinkBase(BaseModel):
    source_type: str  # character, location, chapter, note
    source_id: int
    target_type: str  # character, location, chapter, note
    target_id: int
    link_type: str = "related"
    description: str = ""

class LinkCreate(LinkBase):
    universe_id: Optional[int] = None
    universe_id: Optional[int] = None  # обратная совместимость

class LinkUpdate(BaseModel):
    link_type: Optional[str] = None
    description: Optional[str] = None

class Link(LinkBase):
    id: int
    universe_id: int = Field(alias="universe_id", serialization_alias="universe_id")
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
