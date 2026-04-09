from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime

class NoteBase(BaseModel):
    title: str
    content: str = ""
    note_type: str = "idea"
    enabled: bool = True

class NoteCreate(NoteBase):
    universe_id: Optional[int] = None
    universe_id: Optional[int] = None  # обратная совместимость

class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    note_type: Optional[str] = None
    enabled: Optional[bool] = None

class Note(NoteBase):
    id: int
    universe_id: int = Field(alias="universe_id", serialization_alias="universe_id")
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
