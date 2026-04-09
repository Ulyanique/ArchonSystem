from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime

class QuoteBase(BaseModel):
    character_id: int
    interlocutor_type: str  # "character" | "author" | "helper"
    interlocutor_id: Optional[int] = None
    quote_text: str
    context: Optional[str] = None

class QuoteCreate(QuoteBase):
    universe_id: Optional[int] = None
    universe_id: Optional[int] = None  # обратная совместимость

class QuoteUpdate(BaseModel):
    character_id: Optional[int] = None
    interlocutor_type: Optional[str] = None
    interlocutor_id: Optional[int] = None
    quote_text: Optional[str] = None
    context: Optional[str] = None

class Quote(QuoteBase):
    id: int
    universe_id: int = Field(alias="universe_id", serialization_alias="universe_id")
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
