from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime

# Technology
class TechnologyBase(BaseModel):
    name: str
    description: Optional[str] = ""
    tech_level: Optional[str] = ""
    principles: Optional[str] = ""
    application: Optional[str] = ""

class TechnologyCreate(TechnologyBase):
    pass

class TechnologyUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    tech_level: Optional[str] = None
    principles: Optional[str] = None
    application: Optional[str] = None

class TechnologySchema(TechnologyBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    universe_id: int
    created_at: datetime
    updated_at: datetime

# Artifact
class ArtifactBase(BaseModel):
    name: str
    description: Optional[str] = ""
    artifact_type: Optional[str] = ""
    origin: Optional[str] = ""
    abilities: Optional[str] = ""
    location_hint: Optional[str] = ""
    owner_id: Optional[int] = None

class ArtifactCreate(ArtifactBase):
    pass

class ArtifactUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    artifact_type: Optional[str] = None
    origin: Optional[str] = None
    abilities: Optional[str] = None
    location_hint: Optional[str] = None
    owner_id: Optional[int] = None

class ArtifactSchema(ArtifactBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    universe_id: int
    created_at: datetime
    updated_at: datetime
