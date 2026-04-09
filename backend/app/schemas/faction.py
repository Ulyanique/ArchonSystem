from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime

class FactionBase(BaseModel):
    name: str
    description: Optional[str] = ""
    faction_type: Optional[str] = ""
    ideology: Optional[str] = ""
    goals: Optional[str] = ""
    headquarters: Optional[str] = ""
    leader_name: Optional[str] = ""
    influence_level: Optional[int] = 5

class FactionCreate(FactionBase):
    pass

class FactionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    faction_type: Optional[str] = None
    ideology: Optional[str] = None
    goals: Optional[str] = None
    headquarters: Optional[str] = None
    leader_name: Optional[str] = None
    influence_level: Optional[int] = None

class FactionSchema(FactionBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    universe_id: int
    created_at: datetime
    updated_at: datetime
