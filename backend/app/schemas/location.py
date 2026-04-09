from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime

class LocationBase(BaseModel):
    name: str
    description: str = ""
    location_type: str = ""
    details: str = ""
    enabled: bool = True
    celestial_body_id: Optional[int] = None  # локация на небесном теле (планета, спутник, станция)

class LocationCreate(LocationBase):
    universe_id: Optional[int] = None
    universe_id: Optional[int] = None  # обратная совместимость

class LocationUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    location_type: Optional[str] = None
    details: Optional[str] = None
    enabled: Optional[bool] = None
    celestial_body_id: Optional[int] = None
    image_path: Optional[str] = None
    image_ai_prompt: Optional[str] = None

class Location(LocationBase):
    id: int
    universe_id: int = Field(alias="universe_id", serialization_alias="universe_id")
    image_path: Optional[str] = None
    image_ai_prompt: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
