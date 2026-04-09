from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime

# Galaxy
class GalaxyBase(BaseModel):
    name: str
    description: Optional[str] = ""
    galaxy_type: Optional[str] = ""

class GalaxyCreate(GalaxyBase):
    pass

class GalaxyUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    galaxy_type: Optional[str] = None

class GalaxySchema(GalaxyBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    universe_id: int
    created_at: datetime
    updated_at: datetime

# StarSystem
class StarSystemBase(BaseModel):
    name: str
    description: Optional[str] = ""
    galaxy_id: int
    coord_x: Optional[float] = 0.0
    coord_y: Optional[float] = 0.0
    coord_z: Optional[float] = 0.0

class StarSystemCreate(StarSystemBase):
    pass

class StarSystemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    coord_x: Optional[float] = None
    coord_y: Optional[float] = None
    coord_z: Optional[float] = None

class StarSystemSchema(StarSystemBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    universe_id: int
    created_at: datetime
    updated_at: datetime

# CelestialBody
class CelestialBodyBase(BaseModel):
    name: str
    description: Optional[str] = ""
    star_system_id: int
    parent_body_id: Optional[int] = None  # спутник орбитирует планету/тело
    body_type: Optional[str] = ""
    map_width: Optional[int] = 10
    map_height: Optional[int] = 10
    map_data: Optional[str] = "[]"

class CelestialBodyCreate(CelestialBodyBase):
    pass

class CelestialBodyUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    parent_body_id: Optional[int] = None
    body_type: Optional[str] = None
    map_width: Optional[int] = None
    map_height: Optional[int] = None
    map_data: Optional[str] = None

class CelestialBodySchema(CelestialBodyBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    universe_id: int
    created_at: datetime
    updated_at: datetime
