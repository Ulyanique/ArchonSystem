from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime

class UniverseBase(BaseModel):
    title: str
    description: str = ""
    genre: str = ""
    direction: str = ""
    style_notes: str = ""
    universe_type: str = ""

    # Внутреннее время
    clock_enabled: Optional[bool] = False
    universe_start_year: Optional[int] = 2026
    universe_start_day: Optional[int] = 1
    universe_start_hour: Optional[int] = 0
    universe_hours_per_day: Optional[int] = 24
    universe_days_per_year: Optional[int] = 365
    universe_epoch_name: Optional[str] = "н.э."
    universe_time_scale: Optional[float] = 1.0

class UniverseCreate(UniverseBase):
    pass

class UniverseUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    genre: Optional[str] = None
    direction: Optional[str] = None
    style_notes: Optional[str] = None
    universe_type: Optional[str] = None
    cover_image_path: Optional[str] = None

    # Внутреннее время
    clock_enabled: Optional[bool] = None
    universe_start_year: Optional[int] = None
    universe_start_day: Optional[int] = None
    universe_start_hour: Optional[int] = None
    universe_hours_per_day: Optional[int] = None
    universe_days_per_year: Optional[int] = None
    universe_epoch_name: Optional[str] = None
    universe_reference_real_date: Optional[datetime] = None
    universe_time_scale: Optional[float] = None

class Universe(UniverseBase):
    id: int
    created_at: datetime
    updated_at: datetime
    cover_image_path: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

# Aliases for compatibility
UniverseBase = UniverseBase
UniverseCreate = UniverseCreate
UniverseUpdate = UniverseUpdate
Universe = Universe
